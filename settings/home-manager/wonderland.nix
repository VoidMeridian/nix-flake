{lib, ...}: {
  imports = [../wonderland.nix];
  config.firefoxZoom = 1;
  config.home.activation = {
    removeGtkrc = lib.hm.dag.entryAfter ["writeBoundary"] ''
      run rm ~/.gtkrc-2.0 -rf
    '';
  };
}
