import axios from "axios";
import browser from "webextension-polyfill";
import Sizzle from "sizzle";
import { isDebug } from "@/shared/constants/env";

function initDebug() {
  Object.assign(window as any, {
    axios,
    browser,
    Sizzle,
  });
}

isDebug && initDebug();
