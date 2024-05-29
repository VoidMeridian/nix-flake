{
  pkgs,
  config,
  ...
}: let
  metacopy = pkgs.writeScriptBin "metacopy" ''
    #! /usr/bin/env nix-shell
    #! nix-shell -i bash -p bash ffmpeg yt-dlp mpc-cli
    yt-dlp "$1" -x --audio-format m4a -o file.m4a
    ffmpeg -i "$2" -i file.m4a -map 1 -c copy -map_metadata 0 out.m4a
    rm file.m4a
    mv out.m4a "$2"
    mpc update
  '';
  krisp-patcher = pkgs.writers.writePython3Bin "krisp-patcher" {
    libraries = with pkgs.python3Packages; [capstone pyelftools];
    flakeIgnore = [
      "E501"
      "F403"
      "F405"
    ];
  } (builtins.readFile ../sources/krisp-patcher.py);
in {
  imports = [
    ./plasma.nix
    ./firefox/firefox.nix
    ./gtk.nix
    ./hyprland/default.nix
    ./zsh.nix
    ./kitty.nix
    ./mpd.nix
    ./vscode.nix
  ];
  # hyprland.enable = true;
  services.mpd-discord-rpc.enable = true;
  programs.ncmpcpp.enable = true;
  programs.micro = {
    enable = true;
    catppuccin.enable = true;
  };

  programs.git = {
    enable = true;
    userName = "Miss Vampira";
    userEmail = "voidmeridian@gmail.com";
  };

  home.packages = with pkgs; [pure-prompt keepassxc discord pavucontrol qpwgraph jetbrains.clion krisp-patcher metacopy prismlauncher] ++ lib.optionals config.hyprland.enable [swaybg swayimg];
}
