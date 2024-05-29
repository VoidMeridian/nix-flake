{
  lib,
  outputs,
  ...
}:
with lib; {
  options.username = mkOption {
    type = types.str;
    default = "${outputs.username}";
  };
}
