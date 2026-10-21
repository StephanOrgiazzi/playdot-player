using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace PlaydotAudioMirror
{
    // Stereo frame queue. A very small adaptive ratio compensates independent
    // device clocks; a bounded queue prevents delay from growing indefinitely.
    public sealed class StereoQueue : ISampleProvider
    {
        readonly object sync = new object();
        readonly float[] samples;
        readonly int rate, capacity;
        int read, frames, delayFrames;
        double fraction;
        bool primed;
        float targetGain = .5f, gain = .5f;
        bool ambience;
        float ambienceMix;
        public float InputPeak, OutputPeak;
        public long ReceivedFrames, PlayedFrames, DroppedFrames, Underruns;
        public WaveFormat WaveFormat { get; private set; }
        public StereoQueue(int sampleRate)
        {
            rate = sampleRate; capacity = sampleRate * 4;
            samples = new float[capacity * 2];
            WaveFormat = WaveFormat.CreateIeeeFloatWaveFormat(sampleRate, 2);
        }
        public void SetDelay(int milliseconds)
        {
            if (milliseconds < 0 || milliseconds > 1200) throw new ArgumentOutOfRangeException();
            lock (sync) {
                int next = (int)((long)milliseconds * rate / 1000);
                if (next < delayFrames && primed) {
                    int discard = Math.Min(frames, delayFrames - next);
                    read = (read + discard) % capacity; frames -= discard;
                    DroppedFrames += discard;
                }
                delayFrames = next; primed = false; fraction = 0;
            }
        }
        public void SetAmbience(bool enabled) { lock(sync) ambience = enabled; }
        public void SetGain(float value)
        { lock (sync) { targetGain = Math.Max(0, Math.Min(2, value)); if(PlayedFrames==0) gain=targetGain; } }
        public double QueuedMilliseconds
        { get { lock (sync) return frames * 1000.0 / rate; } }
        public void Add(float[] input, int count, int channels)
        {
            if (channels != 1 && channels != 2) throw new NotSupportedException("La source doit etre mono ou stereo.");
            lock (sync)
            {
                float peak = 0;
                for (int n = 0; n + channels <= count; n += channels)
                {
                    float l = Clean(input[n]), r = channels == 1 ? l : Clean(input[n + 1]);
                    peak = Math.Max(peak, Math.Max(Math.Abs(l), Math.Abs(r)));
                    if (frames == capacity) { read = (read + 1) % capacity; frames--; DroppedFrames++; }
                    int write = ((read + frames) % capacity) * 2;
                    samples[write] = l; samples[write + 1] = r; frames++; ReceivedFrames++;
                }
                InputPeak = Math.Max(peak, InputPeak * .85f);
            }
        }
        static float Clean(float value)
        { return float.IsNaN(value) || float.IsInfinity(value) ? 0 : value; }
        public int Read(float[] output, int offset, int count)
        {
            if ((count & 1) != 0) throw new ArgumentException("Une lecture stereo exige un nombre pair d'echantillons.");
            Array.Clear(output, offset, count);
            lock (sync)
            {
                int requested = count / 2;
                // Keep one render quantum plus 20 ms in addition to the chosen
                // delay. This protects against scheduling jitter at delay=0.
                int reserve = delayFrames + rate / 50;
                int desired = reserve + requested + 2;
                if (!primed)
                {
                    if (frames < desired) { OutputPeak *= .8f; return count; }
                    primed = true; fraction = 0;
                }
                // A delay reduction or a scheduler pause must not replay stale
                // audio seconds later. Discard only when far outside the target.
                if (frames > desired + rate / 4)
                {
                    int discard = frames - desired;
                    read = (read + discard) % capacity; frames -= discard;
                    DroppedFrames += discard; fraction = 0;
                }
                double error = frames - desired;
                double ratio = 1 + Math.Max(-.002, Math.Min(.002, error / (rate * 8.0)));
                float peak = 0;
                for (int n = 0; n < requested; n++)
                {
                    if (frames < 2)
                    { Underruns++; primed = false; fraction = 0; break; }
                    int a = read * 2, b = ((read + 1) % capacity) * 2;
                    gain += (targetGain - gain) * .002f;
                    float l = (float)(samples[a] + (samples[b] - samples[a]) * fraction) * gain;
                    float r = (float)(samples[a + 1] + (samples[b + 1] - samples[a + 1]) * fraction) * gain;
                    // Side component attenuates centered dialogue on the PC pair.
                    // This is a stereo effect, not decoded surround channels.
                    ambienceMix += ((ambience ? 1f : 0f) - ambienceMix) * .002f;
                    float side = (l - r) * .5f;
                    l += (side - l) * ambienceMix;
                    r += (-side - r) * ambienceMix;
                    l = Math.Max(-.98f, Math.Min(.98f, l)); r = Math.Max(-.98f, Math.Min(.98f, r));
                    output[offset + n * 2] = l; output[offset + n * 2 + 1] = r;
                    peak = Math.Max(peak, Math.Max(Math.Abs(l), Math.Abs(r)));
                    fraction += ratio;
                    int consumed = (int)fraction;
                    fraction -= consumed;
                    read = (read + consumed) % capacity; frames -= consumed; PlayedFrames++;
                }
                OutputPeak = Math.Max(peak, OutputPeak * .8f);
            }
            return count;
        }
    }

    public sealed class DeviceChoice
    {
        public string Id, Name;
        public override string ToString() { return Name; }
    }

    public sealed class Bridge : IDisposable
    {
        MMDeviceEnumerator enumerator;
        MMDevice sourceDevice, targetDevice;
        WasapiLoopbackCapture capture;
        WasapiOut playback;
        BufferedWaveProvider captureBuffer;
        ISampleProvider converter;
        float[] decoded = new float[4096];
        volatile bool stopping;
        public StereoQueue Queue { get; private set; }
        public string Error;
        public void Start(string source, string target, int delay, int volume)
        {
            if (String.Equals(source, target, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("La source et les enceintes doivent etre differentes : sinon cela cree une boucle.");
            try
            {
                stopping = false; Error = null;
                enumerator = new MMDeviceEnumerator();
                sourceDevice = enumerator.GetDevice(source);
                targetDevice = enumerator.GetDevice(target);
                capture = new WasapiLoopbackCapture(sourceDevice);
                WaveFormat format = capture.WaveFormat;
                if (format.Channels > 2)
                    throw new InvalidOperationException("Reglez la source Windows en stereo pour ce premier pont audio.");
                captureBuffer = new BufferedWaveProvider(format);
                captureBuffer.BufferDuration = TimeSpan.FromSeconds(2);
                captureBuffer.DiscardOnBufferOverflow = true;
                captureBuffer.ReadFully = false;
                converter = captureBuffer.ToSampleProvider();
                Queue = new StereoQueue(format.SampleRate);
                Queue.SetDelay(delay); Queue.SetGain(volume / 100f);
                capture.DataAvailable += CaptureData;
                capture.RecordingStopped += delegate(object sender, StoppedEventArgs e)
                { if (!stopping) Error = e.Exception != null ? e.Exception.Message : "La source audio s'est arretee."; };
                playback = new WasapiOut(targetDevice, AudioClientShareMode.Shared, false, 40);
                playback.PlaybackStopped += delegate(object sender, StoppedEventArgs e)
                { if (!stopping) Error = e.Exception != null ? e.Exception.Message : "La sortie audio s'est arretee."; };
                playback.Init(new SampleToWaveProvider(Queue));
                capture.StartRecording();
                playback.Play();
            }
            catch { Dispose(); throw; }
        }
        void CaptureData(object sender, WaveInEventArgs e)
        {
            if (stopping) return;
            try
            {
                captureBuffer.AddSamples(e.Buffer, 0, e.BytesRecorded);
                int channels = converter.WaveFormat.Channels;
                int available = e.BytesRecorded / capture.WaveFormat.BlockAlign * channels;
                if (decoded.Length < available) decoded = new float[available];
                int count = converter.Read(decoded, 0, available);
                Queue.Add(decoded, count, channels);
            }
            catch (Exception ex) { Error = ex.Message; }
        }
        public void Dispose()
        {
            stopping = true;
            if (capture != null) { try { capture.StopRecording(); } catch { } }
            if (playback != null) { try { playback.Stop(); } catch { } playback.Dispose(); playback = null; }
            if (capture != null) { capture.Dispose(); capture = null; }
            if (sourceDevice != null) { sourceDevice.Dispose(); sourceDevice = null; }
            if (targetDevice != null) { targetDevice.Dispose(); targetDevice = null; }
            if (enumerator != null) { enumerator.Dispose(); enumerator = null; }
        }
    }

    static class Tests
    {
        static void Check(bool condition, string name, List<string> result)
        { if (!condition) throw new Exception(name); result.Add("PASS " + name); }
        public static int Run()
        {
            List<string> result = new List<string>();
            try
            {
                StereoQueue silent = new StereoQueue(48000); float[] outbuf = new float[960];
                silent.Read(outbuf,0,outbuf.Length);
                Check(Array.TrueForAll(outbuf, delegate(float f) { return f==0; }), "Source absente : silence", result);
                StereoQueue delayed = new StereoQueue(48000); delayed.SetDelay(200);
                float[] stereo = new float[4800*2]; for(int i=0;i<stereo.Length;i+=2){ stereo[i]=.4f; stereo[i+1]=-.2f; }
                delayed.Add(stereo,stereo.Length,2); delayed.Read(outbuf,0,outbuf.Length);
                Check(delayed.PlayedFrames==0, "Le delai attend assez de donnees", result);
                delayed.Add(stereo,stereo.Length,2); delayed.Add(stereo,stereo.Length,2);
                delayed.Read(outbuf,0,outbuf.Length);
                Check(outbuf[0]>0 && outbuf[1]<0, "Canaux gauche/droite preserves", result);
                Check(Math.Abs(outbuf[0]-.2f)<.001, "Gain initial a 50 %", result);
                StereoQueue overflow = new StereoQueue(48000);
                for(int i=0;i<50;i++) overflow.Add(stereo,stereo.Length,2);
                Check(overflow.QueuedMilliseconds<=4000 && overflow.DroppedFrames>0, "Tampon borne en cas de blocage", result);
                delayed.SetGain(0);
                for(int i=0;i<30;i++) { delayed.Add(stereo,stereo.Length,2); delayed.Read(outbuf,0,outbuf.Length); }
                Check(Math.Abs(outbuf[outbuf.Length-1])<.000001, "Volume nul sans signal residuel", result);
                StereoQueue finite = new StereoQueue(48000);
                float[] invalid = new float[10000]; for(int i=0;i<invalid.Length;i++) invalid[i]=float.NaN;
                finite.Add(invalid,invalid.Length,2); finite.Read(outbuf,0,outbuf.Length);
                Check(Array.TrueForAll(outbuf,delegate(float f){return !float.IsNaN(f) && !float.IsInfinity(f);}), "Echantillons invalides neutralises", result);
                Check(ClockSimulation(.00015) && ClockSimulation(-.00015), "Derive des horloges +/-150 ppm sur 3 minutes", result);
                StereoQueue centered = new StereoQueue(48000); centered.SetAmbience(true);
                float[] monoContent = new float[9600];
                for(int i=0;i<monoContent.Length;i++) monoContent[i]=.4f;
                for(int i=0;i<12;i++) { centered.Add(monoContent,monoContent.Length,2); centered.Read(outbuf,0,outbuf.Length); }
                Check(Math.Abs(outbuf[outbuf.Length-1])<.00001, "Ambiance : centre stereo attenue", result);
                StereoQueue sides = new StereoQueue(48000); sides.SetAmbience(true);
                float[] wideContent = new float[9600];
                for(int i=0;i<wideContent.Length;i+=2) { wideContent[i]=.4f; wideContent[i+1]=-.4f; }
                sides.Add(wideContent,wideContent.Length,2); sides.Read(outbuf,0,outbuf.Length);
                Check(outbuf[0]>.19f && outbuf[1]<-.19f, "Ambiance : composante laterale preservee", result);
                double before=delayed.QueuedMilliseconds; delayed.SetDelay(0);
                Check(delayed.QueuedMilliseconds<before, "Reduction du delai retire le retard accumule", result);
                bool range=false; try { delayed.SetDelay(-1); } catch(ArgumentOutOfRangeException) { range=true; }
                Check(range,"Delai negatif refuse",result);
                StereoQueue muted = new StereoQueue(48000); muted.SetGain(0); muted.Add(stereo,stereo.Length,2); muted.Read(outbuf,0,outbuf.Length);
                Check(Array.TrueForAll(outbuf,delegate(float f){return f==0;}),"Volume nul respecte des le premier echantillon",result);
                Bridge blocked = new Bridge(); bool refused=false;
                try { blocked.Start("same","same",0,50); } catch(InvalidOperationException) { refused=true; }
                Check(refused, "Boucle source=cible refusee avant ouverture audio", result);
                result.Add("Aucun peripherique audio n'a ete ouvert pendant ces tests.");
                File.WriteAllLines(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"self-test.txt"), result.ToArray()); return 0;
            }
            catch(Exception ex)
            {
                result.Add("FAIL " + ex.Message);
                File.WriteAllLines(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"self-test.txt"), result.ToArray()); return 1;
            }
        }
        static bool ClockSimulation(double drift)
        {
            StereoQueue queue = new StereoQueue(48000); queue.SetDelay(180);
            float[] packet = new float[2048], output = new float[960]; double carry=0;
            for(int i=0;i<18000;i++)
            {
                carry += 480*(1+drift); int n=(int)carry; carry-=n;
                queue.Add(packet,n*2,2); queue.Read(output,0,output.Length);
            }
            return queue.Underruns==0 && queue.QueuedMilliseconds<350 && queue.DroppedFrames==0;
        }
    }
}
