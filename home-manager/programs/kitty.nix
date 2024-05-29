{...}: {
  programs.kitty = {
    enable = true;
    catppuccin.enable = true;
    settings = {
      enable_audio_bell = "no";
      cursor_shape = "underline";
      shell_integration = "disabled";
      confirm_os_window_close = 0;
    };
    shellIntegration.enableZshIntegration = false;
    font = {
      name = "CaskaydiaCove NFM";
      size = 12;
    };
  };
}
