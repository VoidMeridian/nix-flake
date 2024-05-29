{
  # pkgs,
  ...
}: {
  programs.vscode = {
    enable = true;
    # extensions = with pkgs; [
    #   vscode-extensions.ms-vscode.cmake-tools
    #   vscode-extensions.kamadorueda.alejandra
    #   vscode-extensions.gruntfuggly.auto-snippet
    #   vscode-extensions.catppuccin.catppuccin-vsc
    #   vscode-extensions.catppuccin.catppuccin-vsc-icons
    #   vscode-extensions.jnoortheen.nix-ide
    #   vscode-extensions.ms-vscode.cpptools
    #   vscode-extensions.formulahendry.code-runner
    #   vscode-extensions.vadimcn.vscode-lldb
    #   vscode-extensions.twxs.cmake
    # ];
  };
}
