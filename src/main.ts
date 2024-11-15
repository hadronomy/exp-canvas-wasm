import "./app.css";
import App from "./App.svelte";

import { set_panic_hook } from "../pkg/vite_rust_wasm";

set_panic_hook();

const app = new App({
	target: document.querySelector<Element>("#app") as Element,
});

export default app;
