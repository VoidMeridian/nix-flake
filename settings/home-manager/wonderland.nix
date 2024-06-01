{lib, ...}: {
  imports = [../wonderland.nix];
  config.firefoxZoom = 1;
  config.home.activation = {
    # just remove gtkrc-2.0 before nixos even checks for it
    removeGtkrc = lib.hm.dag.entryBefore ["checkLinkTargets"] ''
      run rm ~/.gtkrc-2.0 -rf
    '';
  };
}
