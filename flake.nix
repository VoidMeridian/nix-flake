{
  description = "VampiraHive flake.nix";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    # nixos.url = "nixpkgs/unstable";
    razer-laptop-control.url = "github:voidmeridian/razer-laptop-control";
    # nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixos-unstable";
    catppuccin.url = "github:catppuccin/nix";
    nur.url = "github:nix-community/NUR";
    plasma-manager = {
      url = "github:pjones/plasma-manager";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.home-manager.follows = "home-manager";
    };
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    self,
    nixpkgs,
    catppuccin,
    nur,
    home-manager,
    plasma-manager,
    razer-laptop-control,
    ...
  } @ inputs: let
    inherit (self) outputs;
    system = "x86_64-linux";
  in {
    packages = import ./pkgs nixpkgs.legacyPackages.${system};
    formatter.${system} = nixpkgs.legacyPackages.${system}.alejandra;
    overlays = import ./overlays {
      inherit inputs;
      pkgs = nixpkgs.legacyPackages.${system};
    };
    username = "vampira";
    hostname = "vampirahive";
    nixosModules = import ./modules/nixos;
    homeModules = import ./modules/home-manager;
    nixosConfigurations = {
      ${outputs.hostname} = nixpkgs.lib.nixosSystem {
        specialArgs = {inherit inputs outputs;};
        modules = [
          razer-laptop-control.nixosModules.default
          catppuccin.nixosModules.catppuccin
          ./nixos/configuration.nix
        ];
      };
    };
    homeConfigurations = {
      "${outputs.username}@${outputs.hostname}" = home-manager.lib.homeManagerConfiguration {
        pkgs = nixpkgs.legacyPackages.x86_64-linux;
        extraSpecialArgs = {inherit inputs outputs;};
        modules = [
          nur.hmModules.nur
          plasma-manager.homeManagerModules.plasma-manager
          catppuccin.homeManagerModules.catppuccin
          ./home-manager/home.nix
        ];
      };
    };
  };
}
