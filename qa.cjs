const { chromium } = require("@playwright/test");
const path = require("path");

(async () => {
  const extensionPath = path.resolve(".output/chrome-mv3");
  const profilePath = path.resolve(".profiles/manual-linux-do-it-qa");

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log("Navigating to https://linux.do/posted");
  await page.goto("https://linux.do/posted", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000); // Let the plugin inject

  // 1. Open the first topic
  const firstTopic = await page.$('.ldcv-card');
  if (firstTopic) {
    console.log("Found a topic card, clicking it.");
    await firstTopic.click();
    await page.waitForTimeout(2000); // Wait for modal to open
    
    // Check if Reader Modal exists
    const readerModal = await page.$('div[data-react-reader-modal="true"]');
    if (readerModal) {
      console.log("Reader Modal opened successfully.");

      // 2. Check if comments are visible initially
      const comments = await page.$$('.ldcv-reader-comment');
      console.log(`Found ${comments.length} comments initially.`);

      if (comments.length > 0) {
        // Find text of first comment to test search
        const firstCommentText = await comments[0].$eval('.ldcv-reader-comment__body', el => el.textContent.trim().substring(0, 5));
        console.log(`Will search for: "${firstCommentText}"`);

        // 3. Test clicking user ID for preview card
        const firstUserLink = await page.$('.ldcv-reader-comment .ldcv-reader-comment__head a[data-reader-user-preview]');
        if (firstUserLink) {
          console.log("Clicking user link for preview...");
          await firstUserLink.click();
          await page.waitForTimeout(1000);
          
          // Wait for user preview
          const userPreview = await page.$('.ldcv-user-preview');
          console.log("User Preview Card exists:", !!userPreview);
        } else {
          console.log("Could not find a user link in the comments.");
        }

        // 4. Test OP filter and search
        const opFilter = await page.$('input[data-reader-only-op]');
        const searchBox = await page.$('input[data-reader-comment-search]');
        if (opFilter && searchBox) {
          console.log("Found OP filter and search box.");
          
          // Click OP Filter
          console.log("Checkbox before click:", await opFilter.isChecked());
          await opFilter.click();
          await page.waitForTimeout(1000);
          console.log("Checkbox after click:", await opFilter.isChecked());

          let visibleAfterOp = await page.$$eval('.ldcv-reader-comment', elements => elements.length);
          console.log("Rendered comments after clicking OP filter:", visibleAfterOp);

          // Click OP again to uncheck
          await opFilter.click();
          await page.waitForTimeout(1000);

          // Type in search box and press Enter
          await searchBox.fill("SOMETHING_THAT_DOES_NOT_EXIST_12345");
          await searchBox.press('Enter');
          await page.waitForTimeout(1000);

          let visibleAfterSearch = await page.$$eval('.ldcv-reader-comment', elements => elements.length);
          console.log(`Rendered comments after typing dummy text in search box:`, visibleAfterSearch);
        } else {
          console.log("Could not find OP filter or search box.");
        }
      }
      
    } else {
      console.log("Reader Modal did NOT open.");
    }
  } else {
    console.log("No topic cards found on the page.");
  }
  
  // Close Chrome
  await context.close();
})();
