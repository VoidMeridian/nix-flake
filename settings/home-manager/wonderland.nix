{...}: {
  imports = [../wonderland.nix];
  config.firefoxZoom = 1;
  config.home.file.".gtkrc-2.0".force = true;
}
