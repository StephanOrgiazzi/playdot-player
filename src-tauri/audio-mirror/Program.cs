using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using NAudio.CoreAudioApi;

namespace PlaydotAudioMirror
{
    static class Program
    {
        const int DelayMilliseconds = 200, VolumePercent = 100;

        static DeviceChoice FindDevice(bool source)
        {
            // Enabling duplication can take a few seconds to expose HDMI audio.
            var timer=Stopwatch.StartNew();
            while(true)
            {
                DeviceChoice device=TryFindDevice(source);
                if(device!=null) return device;
                if(!source || timer.ElapsedMilliseconds>=10000)
                    throw new InvalidOperationException(source
                        ? "Connect and enable EAZZE_D1Max HDMI audio before enabling Dolby Surround."
                        : "A single active Realtek Speakers output is required for Dolby Surround.");
                Thread.Sleep(250);
            }
        }

        static DeviceChoice TryFindDevice(bool source)
        {
            var matches = new List<DeviceChoice>();
            using(var devices = new MMDeviceEnumerator())
            {
                foreach(var device in devices.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
                {
                    using(device)
                    {
                        string name = device.FriendlyName;
                        bool match = source
                            ? name.IndexOf("D1Max", StringComparison.OrdinalIgnoreCase) >= 0
                            : name.IndexOf("Realtek", StringComparison.OrdinalIgnoreCase) >= 0
                                && (name.StartsWith("Haut-parleurs", StringComparison.OrdinalIgnoreCase)
                                    || name.StartsWith("Speakers", StringComparison.OrdinalIgnoreCase));
                        if(match) matches.Add(new DeviceChoice { Id=device.ID, Name=name });
                    }
                }
            }
            if(matches.Count > 1) throw new InvalidOperationException(source
                ? "Dolby Surround requires a single active D1Max HDMI output."
                : "Dolby Surround requires a single active Realtek Speakers output.");
            return matches.Count==1 ? matches[0] : null;
        }

        static int Main(string[] args)
        {
            if(args.Length==1 && args[0]=="--self-test") return Tests.Run();
            bool ready=false;
            try
            {
                DeviceChoice source=FindDevice(true), target=FindDevice(false);
                using(var bridge=new Bridge())
                using(var stopped=new ManualResetEvent(false))
                {
                    bridge.Start(source.Id,target.Id,DelayMilliseconds,VolumePercent);
                    bridge.Queue.SetAmbience(false);
                    // mpv's public WASAPI names omit the MMDevice prefix.
                    string mpvId=source.Id.StartsWith("{0.0.0.00000000}.",StringComparison.Ordinal)
                        ? source.Id.Substring("{0.0.0.00000000}.".Length) : source.Id;
                    Console.WriteLine("READY\twasapi/"+mpvId);
                    Console.Out.Flush(); ready=true;
                    // EOF stops the worker if PLAY. exits unexpectedly.
                    var inputThread=new Thread(delegate() {
                        try { Console.ReadLine(); } finally { stopped.Set(); }
                    });
                    inputThread.IsBackground=true; inputThread.Start();
                    while(!stopped.WaitOne(100))
                        if(bridge.Error!=null) throw new InvalidOperationException(bridge.Error);
                }
                return 0;
            }
            catch(Exception error)
            {
                string message=error.Message.Replace('\r',' ').Replace('\n',' ').Replace('\t',' ');
                if(!ready) { Console.WriteLine("ERROR\t"+message); Console.Out.Flush(); }
                else Console.Error.WriteLine(message);
                return 1;
            }
        }
    }
}
