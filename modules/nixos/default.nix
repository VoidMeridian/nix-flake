{lib, ...}:
with lib; {
  imports = [
    ../common.nix
  ];
  options.extraPackages = mkOption {
    type = types.listOf types.package;
    default = [];
  };
}
