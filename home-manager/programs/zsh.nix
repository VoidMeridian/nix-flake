{...}: {
  programs.zsh = {
    enable = true;
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;
    oh-my-zsh = {
      enable = true;
      plugins = ["git" "sudo"];
    };
    initExtra = ''
      autoload -U promptinit && promptinit && prompt pure
      export XDG_DATA_HOME="$HOME/.local/share"
          echo '\e[4 q'

    '';
    initExtraFirst = ''
    '';
  };
}
