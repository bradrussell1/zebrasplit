// Native: the real WebView. Metro picks captcha-webview.web.tsx for the web export, where
// react-native-webview has no implementation and the captcha is simply off.
export { WebView as CaptchaWebView } from "react-native-webview";
