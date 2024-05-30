{...}: {
  imports = [../wonderland.nix];
  config.services.asusd = {
    enable = true;
    enableUserService = true;
  };
}
