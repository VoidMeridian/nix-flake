{
  outputs,
  lib,
  pkgs,
  inputs,
  config,
  ...
}: let
  basePackages = with pkgs; let
    screenshot = writeScriptBin "screenshot" ''
      [[ -z \$\{DIR\} ]] && DIR="$HOME/Pictures"
      [[ -z \$\{NAME+z\} ]] && NAME="$(date "+%Y%m%d_%H%M-%3N").png"
      grim -g "$(slurp)" - | wl-copy
      wl-paste > "$DIR/$NAME"
    '';
  in [
    wget
    iw
    kdePackages.qtstyleplugin-kvantum
    # catppuccin-kde
    catppuccin-sddm
    # catppuccin-gtk
    # catppuccin-kvantum
    qt5.qtwebchannel
    qt5.qtwebsockets
    python312Packages.websockets
    qt5.full
    nvtopPackages.full
    wget
    lshw
    curl
    file
    wlr-randr
    screenshot
    wl-clipboard
    grim
    slurp
    strawberry
    wlprop
    feh
    lxde.lxsession
    xwaylandvideobridge
    glib
    lm_sensors
    gnome.dconf-editor
    giflib
    yt-dlp
    swayimg
    ffmpeg
    kdePackages.sddm-kcm
    outputs.formatter.x86_64-linux
    # xfce.thunar
    nil
    gcc
    clang
    lldb
    clang-tools
    premake5
    cmake
    gnumake
  ];
in {
  programs.partition-manager.enable = true;
  programs.zsh.enable = true;
  programs.steam.enable = true;
  programs.firefox.enable = true;
  programs.git.enable = true;
  programs.dconf.enable = true;
  # programs.nm-applet.enable = true;
  programs.gamemode.enable = true;
  programs.xfconf.enable = true;
  # programs.thunar.enable = true;
  programs.nix-index = {
    enable = true;
    enableZshIntegration = true;
  };
  programs.command-not-found.enable = lib.mkForce false;
  environment.systemPackages = with pkgs; let
    razerdaemon = writeScriptBin "razerdaemon" ''
      sudo ${
        inputs.razer-laptop-control.packages.x86_64-linux.default
      }/libexec/daemon
    '';
  in
    if config.hostname == "vampirahive"
    then
      basePackages
      ++ [
        openrazer-daemon
        razergenie
        razerdaemon
        inputs.razer-laptop-control.packages.x86_64-linux.default
      ]
    else basePackages;
}
