import chalk from "chalk";
import { exec } from "child_process";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { By, until } from "selenium-webdriver";
import {
  MoveTargetOutOfBoundsError,
  StaleElementReferenceError,
} from "selenium-webdriver/lib/error.js";
import { distinguishKey } from "./constants.js";

/**
 * Update site
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {import('selenium-webdriver').WebElement} siteButtonElement
 * @param {{ label?: string, url: string, customScreenshotURL?: string }} siteData
 */
export async function updateSite(driver, siteButtonElement, siteData) {
  try {
    await driver.executeScript(
      "arguments[0].scrollIntoView();",
      siteButtonElement
    );
    /**
     * @type {import('selenium-webdriver').Actions}
     */
    const actions = driver.actions();
    // hover vào button site để hiển thị 3 dots menu
    await actions.move({ origin: siteButtonElement }).perform();

    const threeDotsSelector = ".context-menu-button.icon";
    const threeDotsButton = await siteButtonElement.findElement(
      By.css(threeDotsSelector)
    );
    await threeDotsButton.click();

    // Chờ phần tử menu xuất hiện
    await driver.wait(until.elementLocated(By.css(".context-menu")), 5000);

    // Tìm button với data-l10n-id là 'newtab-menu-edit-topsites'
    const editButton = await driver.findElement(
      By.css('[data-l10n-id="newtab-menu-edit-topsites"]')
    );

    // Lấy phần tử cha (li) của button và click vào nó
    const parentButton = await editButton.findElement(
      By.xpath("ancestor::button[1]")
    ); // Lấy phần tử button cha gần nhất
    await parentButton.click();

    // Chờ dialog với class 'topsite-form' xuất hiện
    await driver.wait(until.elementLocated(By.css(".topsite-form")), 5000);

    // Nhập thông tin vào form
    console.log("inspect.siteData", siteData);
    /**
     * @type {import('selenium-webdriver').WebElementPromise}
     */
    const inputLabel = await driver.findElement(
      By.css('input[data-l10n-id="newtab-topsites-title-input"]')
    );
    await inputLabel.clear();
    inputLabel.sendKeys(siteData.label ?? "");

    const inputUrl = await driver.findElement(
      By.css('input[data-l10n-id="newtab-topsites-url-input"]')
    );
    await inputUrl.clear();
    inputUrl.sendKeys(siteData.url);

    const buttonSave = await driver.findElement(
      By.css('button[data-l10n-id="newtab-topsites-save-button"]')
    );
    buttonSave.click();
    driver.sleep(100);
  } catch (error) {
    if (error instanceof MoveTargetOutOfBoundsError) {
      console.error(chalk.red("Site button is out of viewport.😵‍💫"));
      return;
    }
    console.error(chalk.red("Error updating site:"), error);
  }
}

/**
 * @typedef {Object} CssFilter
 * @property {string} hasNoDescendantsSelector - css selector that descendants should not have
 */

/**
 * Get elements
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {string} selector
 * @param {CssFilter[]} cssFilters
 * @returns {Promise<import('selenium-webdriver').WebElement[]>}
 */
export async function getElements(driver, selector, cssFilters = []) {
  /**
   * @type {import('selenium-webdriver').WebElement[]}
   */
  const allElements = await driver.findElements(By.css(selector));

  /**
   * @type {import('selenium-webdriver').WebElement[]}
   */
  const filteredElements = [];

  // Lọc các phần tử
  const [firstFilter] = cssFilters;
  if (firstFilter && firstFilter.hasNoDescendantsSelector) {
    for (const element of allElements) {
      try {
        const mark = await element.findElements(
          By.css(firstFilter.hasNoDescendantsSelector)
        );
        if (mark.length === 0) filteredElements.push(element);
      } catch (err) {
        if (err instanceof StaleElementReferenceError) {
          console.log(
            chalk.red("inspect.staleElementReferenceError"),
            err.message
          );
        } else {
          console.log(chalk.red("inspect.otherError"), err);
        }
      }
    }
  }
  return filteredElements;
}

/**
 * Copy folder
 * @param {string} sourcePath
 * @param {string} destPath
 */
export async function copyFolder(sourcePath, destPath) {
  try {
    if (sourcePath === destPath) {
      console.log("Source and destination paths cannot be the same.");
      return;
    }
    await fs.emptyDir(destPath);

    // Sao chép thư mục
    await fs.copy(sourcePath, destPath);
    console.log(
      chalk.green(
        `Folder copied from "${sourcePath}" to "${destPath}" successfully.`
      )
    );
  } catch (error) {
    console.error("Error copying folder:", error);
  }
}

/**
 * tl;dr Find Firefox profile path
 */
export async function findFirefoxProfile() {
  return new Promise((resolve, reject) => {
    exec('pgrep -fl "Firefox"', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        return reject(error);
      }

      const processes = stdout.split("\n");
      let found = false;
      let path = null;

      for (const process of processes) {
        if (process.includes(distinguishKey)) {
          const regex = /-profile\s+([^ ]+)/; // Regex to extract the profile path
          const match = regex.exec(process);
          if (match && match[1]) {
            const profilePath = match[1];
            console.log(chalk.green(`Found profile path:`), profilePath);
            found = true;
            path = profilePath;
            break;
          }
        }
      }

      if (!found) {
        return reject(new Error("Cannot find Firefox PID"));
      }
      resolve(path); // Trả về đường dẫn profile nếu tìm thấy
    });
  });
}

export function convertTildeToAbsolute(pathString) {
  if (pathString.startsWith("~")) {
    // Thay thế '~' bằng thư mục home
    return path.join(os.homedir(), pathString.slice(1));
  }
  return pathString; // Nếu không bắt đầu bằng '~', trả về chính nó
}
