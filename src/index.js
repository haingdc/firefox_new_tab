import { input } from "@inquirer/prompts";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { Browser, Builder, By } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import data from "../pinned_tabs.json" assert { type: "json" };
import {
  distinguishKey,
  sitesPerRow,
  subPinnedSitesNumber,
} from "./constants.js";
import {
  convertTildeToAbsolute,
  copyFolder,
  findFirefoxProfile,
  getElements,
  updateSite,
} from "./utils.js";

// Định nghĩa kiểu dữ liệu
/**
 * @typedef {Object} PinnedTab
 * @property {string?} title - Tiêu đề của tab.
 * @property {string} url - URL của tab.
 * @property {string?} imageUrl - URL hình ảnh cho tab (có thể là null).
 */

const truthyData = data.filter((n) => n !== null);

/** @type {PinnedTab[]} */
const sitesToPin =
  process.env.SUB_PINNED_SITES === "true"
    ? truthyData.slice(0, subPinnedSitesNumber)
    : truthyData;
console.log(chalk.green("inspect.sitesToPin"), sitesToPin.length);

const topSitesRows = Math.ceil(sitesToPin.length / sitesPerRow) + 1;

console.log("inspect.driver.start");
/** @type {import('selenium-webdriver').WebDriver} */
let driver;

async function initDriver() {
  /** @type {firefox.Options} */
  let options = new firefox.Options();
  options.setBinary(process.env.FIREFOX_PATH);
  options.setProfile(process.env.FIREFOX_PROFILE_PATH);

  // Cấu hình các tùy chọn tương tự như trong about:config
  options.setPreference("browser.startup.homepage", "about:home"); // Thay đổi homepage
  options.setPreference("browser.download.autohideButton", false);
  // [verified] set number of rows to display in the top sites section
  options.setPreference(
    "browser.newtabpage.activity-stream.topSitesRows",
    topSitesRows
  );
  // [verified] set value to "false" so the window doesn't close when you close the last tab.
  options.setPreference("browser.tabs.closeWindowWithLastTab", false);
  // [verified] equivalent to Settings -> General -> Start up -> Open previous windows and tabs is true
  options.setPreference("browser.startup.page", 3);
  // [verified] equal to Settings -> General -> Tabs -> Ctrl+Tab cycles through tabs in recently used order is true
  options.setPreference("browser.ctrlTab.sortByRecentlyUsed", true);
  // reference: https://github.com/mozilla/geckodriver/issues/1423#issuecomment-438191136
  options.setPreference("media.gmp-manager.updateEnabled", true);

  // Experimental
  options.setPreference("sidebar.verticalTabs", true);
  options.setPreference("sidebar.revamp", true);
  options.setPreference(
    "browser.newtabpage.activity-stream.newtabWallpapers",
    true
  );

  if (process.env.HEADLESS === "true") {
    options.addArguments("--headless");
  }
  options.addArguments(distinguishKey);

  // Khởi động driver
  const driver = await new Builder()
    .forBrowser(Browser.FIREFOX)
    .setFirefoxOptions(options)
    .build();
  return driver;
}

async function setupFirefoxNightly() {
  try {
    // Mở trang web
    await driver.get("about:home"); // Thay thế URL thực tế
    // Giữ Firefox mở cho đến khi bạn yêu cầu tắt
    console.log("Press ENTER to close Firefox...");
    process.stdin.resume();
    let isClosed = false;
    process.stdin.on("data", async () => {
      if (!isClosed) {
        isClosed = true;
        try {
          await driver.quit();
        } catch (error) {
          console.error(chalk.red("Error closing Firefox:"), error);
        }
        console.log("Firefox has been closed.");
        process.stdin.pause(); // Ngừng đọc đầu vào
      }
    });
    // Thực hiện các thao tác khác...
    // log cac button site
    const siteButtonSelector = `.top-site-outer:not(.placeholder.add-button)`; // Ví dụ selector, có thể điều chỉnh
    // Để đếm, cần phải tìm các phần tử một lần nữa
    const topSiteElements = await driver.findElements(
      By.css(siteButtonSelector)
    );

    console.log(
      `Number of elements with class 'top-site-outer': ${topSiteElements.length}`
    );
    for (const site of sitesToPin) {
      const topSiteElement = await getElements(driver, siteButtonSelector, [
        { hasNoDescendantsSelector: ".title.has-icon.pinned" },
      ]);
      if (topSiteElement.at(0)) {
        await updateSite(driver, topSiteElement.at(0), site);
      }
    }
  } catch (error) {
    console.error("An error occurred:", error);
    if (driver) {
      await driver.quit(); // Đảm bảo driver được đóng nếu có lỗi
    }
  }
}

try {
  driver = await initDriver();
} catch (error) {
  console.log(chalk.red("Error creating Firefox driver:"), error.message);
  console.log("🍀🍀🍀🍀 We are closing the process...");
  process.exit(1);
}
try {
  await setupFirefoxNightly();
} catch (error) {
  console.log(chalk.red("Error pin sites to about:newtab:"), error.message);
  console.log("🍀🍀🍀🍀 We are closing the process...");
  process.exit(1);
}

try {
  // Gọi hàm để tìm profile mà selenium-webdriver (SW) sử dụng
  const profilePathSW = await findFirefoxProfile();
  const dirName = path.basename(profilePathSW);
  let destPath = path.join(process.env.FIREFOX_PROFILES_PATH, dirName);
  destPath = convertTildeToAbsolute(destPath);
  let isExist = await fs.pathExists(destPath);
  if (isExist) {
    console.log(chalk.yellow("This destination folder already exists."));
    const answer = await input({ message: "Please enter new folder name:" });
    destPath = path.join(process.env.FIREFOX_PROFILES_PATH, answer);
    destPath = convertTildeToAbsolute(destPath);
    isExist = await fs.pathExists(answer);
    if (isExist) {
      throw new Error("Your Folder is already exist");
    }
  }
  console.log("inspect.destPath", destPath);
  copyFolder(profilePathSW, destPath);
} catch (error) {
  console.log(chalk.red("Error finding Firefox profile:"), error.message);
  console.log("🍀🍀🍀🍀 We are closing the process...");
  process.exit(1);
}
