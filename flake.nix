{
  description = "VampiraHive flake.nix";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    # nixos.url = "nixpkgs/unstable";
    razer-laptop-control.url = "github:voidmeridian/razer-laptop-control";
    # betterdiscord.url = "path:///home/vampira/projects/BDFlake";
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
    # betterdiscord,
    ...
  } @ inputs: let
    inherit (self) outputs;
    system = "x86_64-linux";
  in {
    packages = import nixpkgs {
      inherit system;
      config = {
        allowUnfree = true;
        allowUnfreePredicate = _: true;
        overlays = [
          self.overlays.additions
          self.overlays.modifications
          self.overlays.unstable-packages
        ];
      };
    };
    formatter.${system} = nixpkgs.legacyPackages.${system}.alejandra;
    overlays = import ./overlays {
      inherit inputs;
      pkgs = self.packages;
    };

    nixosModules = import ./modules/nixos;
    homeModules = import ./modules/home-manager;
    nixosConfigurations = {
      vampirahive = nixpkgs.lib.nixosSystem {
        specialArgs = {
          pkgs = self.packages;
          inherit inputs outputs;
        };
        modules = [
          razer-laptop-control.nixosModules.default
          catppuccin.nixosModules.catppuccin
          ./hardware/vampirahive.nix
          ./settings/nixos/vampirahive.nix
          ./nixos/configuration.nix
        ];
      };
      wonderland = nixpkgs.lib.nixosSystem {
        specialArgs = {
          pkgs = self.packages;
          inherit inputs outputs;
        };
        modules = [
          catppuccin.nixosModules.catppuccin
          ./hardware/wonderland.nix
          ./settings/nixos/wonderland.nix
          ./nixos/configuration.nix
        ];
      };
    };
    homeConfigurations = {
      "vampira@vampirahive" = home-manager.lib.homeManagerConfiguration {
        pkgs = self.packages;
        extraSpecialArgs = {
          pkgs = self.packages;
          inherit inputs outputs;
        };
        modules = [
          nur.hmModules.nur
          plasma-manager.homeManagerModules.plasma-manager
          catppuccin.homeManagerModules.catppuccin
          # betterdiscord.homeManagerModules.default
          ./settings/home-manager/vampirahive.nix
          ./home-manager/home.nix
        ];
      };
      "alice@wonderland" = home-manager.lib.homeManagerConfiguration {
        pkgs = self.packages;
        extraSpecialArgs = {inherit inputs outputs;};
        modules = [
          nur.hmModules.nur
          plasma-manager.homeManagerModules.plasma-manager
          catppuccin.homeManagerModules.catppuccin
          ./settings/home-manager/wonderland.nix
          ./home-manager/home.nix
        ];
      };
    };
  };
}
