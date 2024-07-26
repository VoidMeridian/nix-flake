{
  pkgs,
  config,
  ...
}: let
  metacopy = pkgs.writeScriptBin "metacopy" ''
    #! /usr/bin/env nix-shell
    #! nix-shell -i bash -p bash ffmpeg yt-dlp mpc-cli
    yt-dlp "$1" -x --audio-format flac -o file.flac
    ffmpeg -i "$2" -i file.flac -map 1 -c copy -map_metadata 0 out.flac
    rm file.flac
    mv out.flac "$2"
    mpc update
  '';
  nix-clean = pkgs.writeScriptBin "nix-clean" ''
    nix-collect-garbage -d
    sudo nix-collect-garbage -d
  '';
  network-reset = pkgs.writeScriptBin "network-reset" ''
    #! /usr/bin/env nix-shell
    #! nix-shell -i bash -p bash iputils networkmanager
    until ping $1 -c 2;
    do
    nmcli con down $2
    nmcli con up $2
    sleep 3
    done

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
    ./direnv.nix
  ];
  # hyprland.enable = true;
  services.mpd-discord-rpc.enable = true;
  programs.ncmpcpp.enable = true;
  programs.micro = {
    enable = true;
    catppuccin.enable = true;
  };
  # programs.betterdiscord = {
  #   enable = true;
  #   plugins = with config.betterdiscord.packages; [ReadAllNotificationsButton Pluralchum BetterRoleColors NoReplyPing];
  # };
  programs.git = {
    enable = true;
    userName = "Miss Vampira";
    userEmail = "voidmeridian@gmail.com";
  };

  home.packages = with pkgs; [pure-prompt keepassxc discord pavucontrol qpwgraph krisp-patcher metacopy network-reset prismlauncher nix-clean] ++ lib.optionals config.hyprland.enable [swaybg swayimg];
}
