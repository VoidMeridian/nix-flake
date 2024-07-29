{...}: {
  programs.zsh = {
    enable = true;
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;
    oh-my-zsh = {
      enable = true;
      plugins = ["git" "sudo" "direnv"];
    };
    initExtra = ''
      autoload -U promptinit && promptinit && prompt pure
      export XDG_DATA_HOME="$HOME/.local/share"
          echo '\e[4 q'

      alias rustrover="mkdir -p /tmp/rustrover; TMPDIR=/tmp/rustrover rust-rover > /dev/null 2>&1 &"
    '';
    initExtraFirst = ''
      DISABLE_MAGIC_FUNCTIONS=true
    '';
  };
}
