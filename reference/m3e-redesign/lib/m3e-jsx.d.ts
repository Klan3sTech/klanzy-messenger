/**
 * Объявления JSX-тегов для тех M3E-элементов, которые удобнее
 * использовать «как есть» (нужны слоты: slot="prefix", slot="icon" и т.п.).
 * Остальные компоненты берём из типизированных биндингов @m3e/react.
 */
import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "m3e-icon": any;
      "m3e-form-field": any;
      "m3e-dialog-action": any;
      "m3e-nav-rail": any;
      "m3e-nav-item": any;
      "m3e-nav-bar": any;
      "m3e-list": any;
      "m3e-list-item": any;
      "m3e-divider": any;
      "m3e-switch": any;
      "m3e-snackbar": any;
      "m3e-search-bar": any;
      "m3e-tabs": any;
      "m3e-tab": any;
    }
  }
}
