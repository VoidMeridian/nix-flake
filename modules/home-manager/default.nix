{lib, ...}:
with lib; {
  imports = [
    ../common.nix
  ];
  options.firefoxZoom = mkOption {
    type = types.int;
    default = 1;
  };
}
