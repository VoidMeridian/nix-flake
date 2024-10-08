# Edit this configuration file to define what should be installed on
# your system.  Help is available in the configuration.nix(5) man page
# and in the NixOS manual (accessible by running ‘nixos-help’).
{
  # inputs,
  lib,
  config,
  pkgs,
  ...
}: {
  security.sudo = {
    enable = true;
  };
  catppuccin = {
    flavor = "mocha";
    enable = true;
  };
  imports = [
    # Include the results of the hardware scan.
    ./nvidia.nix
    ./security.nix
    ./bluetooth.nix
    ./registry.nix
    ./misc.nix
    ./packages.nix
    ./battery.nix
    ./specialisations.nix
  ];
  services.power-profiles-daemon.enable = false;
  services.udev.enable = true;

  networking.hostName = "${config.hostname}"; # Define your hostname.

  # Enable networking
  networking.networkmanager.enable = true;
  networking.wireless.enable = lib.mkForce false;
  # Enable sound with pipewire.
  # sound.enable = true;
  hardware.pulseaudio.enable = false;
  security.rtkit.enable = true;
  services.pipewire = {
    enable = true;
    alsa.enable = true;
    alsa.support32Bit = true;
    pulse.enable = true;
    #jack.enable = true;
  };
  # force ipv4
  networking.enableIPv6 = false;
  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = true;
    };
  };
  programs.hyprland.enable = lib.mkIf config.hyprland.enable true;

  users.users.${config.username} = {
    isNormalUser = true;
    shell = pkgs.zsh;
    description = "The Vampira Swarm";
    extraGroups = ["networkmanager" "wheel"];
  };

  # List packages installed in system profile. To search, run:
  # $ nix search wget

  # xdg.mime.defaultApplications = {
  #   "inode/directory" = "thunar.desktop";
  # };
  # environment.sessionVariables = {
  #   LIBVA_DRIVER_NAME = "nvidia";
  # };
  environment.variables.EDITOR = "micro";
  nix.settings.experimental-features = ["nix-command" "flakes"];
  nix.settings.auto-optimise-store = true;

  # services.razer-laptop-control.enable = true;
  # This value determines the NixOS release from which the default
  # settings for stateful data, like file locations and database versions
  # on your system were taken. It‘s perfectly fine and recommended to leave
  # this value at the release version of the first install of this system.
  # Before changing this value read the documentation for this option
  # (e.g. man configuration.nix or on https://nixos.org/nixos/options.html).
  system.stateVersion = "24.05"; # Did you read the comment?
}
