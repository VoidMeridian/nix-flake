{
  # config,
  outputs,
  ...
}: {
  imports = [outputs.nixosModules];
  config.hostname = "wonderland";
  config.username = "alice";
}
