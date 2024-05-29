{config, ...}: {
  services.mpd = {
    enable = true;
    musicDirectory = "/home/${config.username}/Music";
    network.listenAddress = "any";
    extraConfig = ''
      audio_output {
        type "pipewire"
        name "pipewire output"
      }
    '';
  };
}
