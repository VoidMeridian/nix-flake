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
  options.hostname = mkOption {
    type = types.str;
    default = "${outputs.hostname}";
  };
}
