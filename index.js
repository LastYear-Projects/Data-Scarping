import axios from 'axios';
import cheerio from 'cheerio';

// Function to check if the text contains cashback-related keywords
function containsCashbackKeywords(text) {
  const keywords = ['קאשבק', 'קאשבאק', 'כסף בחזרה'];
  return keywords.some((keyword) => text.includes(keyword));
}

// Function to extract numerical value from text
function extractNumber(text) {
  const match = text.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

// Function to reorder bidirectional text manually
function reorderBidiText(text) {
  // Split the text by spaces to handle each segment separately
  return text
    .split(' ')
    .map((segment) => {
      // Reverse only the segments that are entirely in Hebrew
      if (/^[\u0590-\u05FF]+$/.test(segment)) {
        return segment.split('').reverse().join('');
      }
      // Return other segments (like numbers) as they are
      return segment;
    })
    .join(' ');
}

// Function to scrape data
async function scrapeWebsite(url) {
  try {
    // Step 1: Make a request to the website
    const { data } = await axios.get(url);

    // Step 2: Load the HTML into cheerio
    const $ = cheerio.load(data);

    // Step 3: Extract the data you need
    const cashbackItems = [];
    $('.category-item').each((index, element) => {
      const title = $(element).find('.caption-title').text().trim();
      const subTitle = $(element).find('.caption-sub-title').text().trim();
      const backgroundImage = $(element)
        .find('.category-featured-benefit')
        .css('background-image');

      // Only include items with cashback-related keywords
      if (
        containsCashbackKeywords(title) ||
        containsCashbackKeywords(subTitle)
      ) {
        cashbackItems.push({
          title: reorderBidiText(title),
          subTitle: subTitle,
          backgroundImage,
        });
      }
    });

    // Step 4: Fetch details for each cashback item
    for (const item of cashbackItems) {
      if (item.detailUrl) {
        const detailData = await axios.get(item.detailUrl);
        const $detail = cheerio.load(detailData.data);

        const cashbackTitle = $detail('.cashBack-title').text().trim();
        const cashbackDescription = $detail('.cashBack-description')
          .text()
          .trim();
        const dedicatedCoupon = $detail('.dedicate-coupon-block-store-coupon')
          .text()
          .trim();

        item.cashbackDetails = {
          title: reorderBidiText(cashbackTitle),
          description: reorderBidiText(cashbackDescription),
          dedicatedCoupon: reorderBidiText(dedicatedCoupon),
        };
      }
    }

    // Step 5: Print the extracted data
    // console.log(`Data from ${url}:`, cashbackItems);
    pipeToSwipeAdvisor(cashbackItems);
  } catch (error) {
    console.error(`Error scraping the website ${url}:`, error);
  }
}

const pipeToSwipeAdvisor = (data) => {
  const newBenefits = data.map((benefit) => ({
    businessName: benefit.title,
    businessSubTitle: benefit.subTitle,
    creditCardId: '6658b688892bce96bd5d588f',
    discountType: 'cashback',
    valueType: benefit.title.includes('%') ? 'percentage' : 'number',
    value: extractNumber(benefit.title),
    minPurchaseAmount: 0,
  }));

  console.log('Piped data to SwipeAdvisor:', newBenefits);
};

// List of URLs to scrape
const urls = [
  'https://benefits.isracard.co.il/parentcategories/online-benefits/',
  // Add more URLs here
];

// Call the function for each URL
urls.forEach((url) => scrapeWebsite(url));
