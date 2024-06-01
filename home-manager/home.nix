{
  # inputs,
  outputs,
  config,
  lib,
  # pkgs,
  ...
}: {
  catppuccin = {
    flavor = "mocha";
    accent = "mauve";
    # enable = true;
  };
  imports = [
    outputs.homeModules
    ./programs/programs.nix
  ];
  nixpkgs = {
    overlays = [
      outputs.overlays.additions
      outputs.overlays.modifications
      outputs.overlays.unstable-packages
    ];
    config = {
      allowUnfree = true;
      allowUnfreePredicate = _: true;
    };
  };

  home = {
    username = "${config.username}";
    homeDirectory = "/home/${config.username}";
    file = {
      "bg.png".source = ./sources/bg.png;
    };
    activation = {
      # just remove gtkrc-2.0 before nixos even checks for it
      removeGtkrc = lib.hm.dag.entryBefore ["checkLinkTargets"] ''
        run rm ~/.gtkrc-2.0 -rf
      '';
    };
  };
  # xdg.configFile."BetterDiscord/plugins".source = ./plugins;
  xdg.configFile."BetterDiscord/themes".source = ./sources/themes;
  xdg.dataFile."fonts".source = ./sources/fonts;

  xdg.enable = true;

  home.stateVersion = "24.05";

  systemd.user.startServices = "sd-switch";
  programs.home-manager.enable = true;
}
