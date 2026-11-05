/**
 * Явная регистрация M3E-элементов, которые используются «сырыми» тегами.
 * React-биндинги (@m3e/react/*) регистрируют свои элементы сами,
 * но <m3e-form-field>, <m3e-switch> и <m3e-snackbar> мы рендерим как HTML-теги,
 * поэтому их модули нужно импортировать здесь.
 */
import "@m3e/web/form-field";
import "@m3e/web/switch";
import "@m3e/web/snackbar";
import "@m3e/web/icon";
