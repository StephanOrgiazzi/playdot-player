fn main() {
    build_audio_mirror();
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=lib");
    println!("cargo:rerun-if-changed=../shaders");
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/32x32.png");
    println!("cargo:rerun-if-changed=icons/128x128.png");
    println!("cargo:rerun-if-changed=icons/128x128@2x.png");
    println!("cargo:rerun-if-changed=icons/app-icon.svg");
    tauri_build::build()
}

fn build_audio_mirror() {
    println!("cargo:rerun-if-changed=audio-mirror");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }
    let output = std::path::Path::new("lib/audio-mirror");
    std::fs::create_dir_all(output).expect("create audio mirror resource directory");
    for name in ["NAudio.dll", "LICENSE-NAudio.txt"] {
        std::fs::copy(
            std::path::Path::new("audio-mirror").join(name),
            output.join(name),
        )
        .expect("bundle NAudio and its license");
    }
    let compiler = std::path::PathBuf::from(
        std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()),
    )
    .join("Microsoft.NET/Framework64/v4.0.30319/csc.exe");
    let result = std::process::Command::new(compiler)
        .args([
            "/nologo",
            "/target:exe",
            "/platform:anycpu",
            "/optimize+",
            "/out:lib\\audio-mirror\\PlaydotAudioMirror.exe",
            "/reference:audio-mirror\\NAudio.dll",
            "audio-mirror\\AudioMirrorEngine.cs",
            "audio-mirror\\Program.cs",
        ])
        .output()
        .expect("compile the audio mirror with the Windows .NET Framework compiler");
    assert!(
        result.status.success(),
        "audio mirror compilation failed ({}):\n{}\n{}",
        result.status,
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
}
