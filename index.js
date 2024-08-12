import axios from 'axios';
import cheerio from 'cheerio';

// Function to check if the text contains cashback-related keywords
function containsCashbackKeywords(text) {
  const keywords = ['קאשבק', 'קאשבאק', 'כסף בחזרה', 'החזר כספי'];
  return keywords.some((keyword) => text.includes(keyword));
}

// Function to construct absolute URL from base URL and relative URL
function resolveUrl(baseUrl, relativeUrl) {
  if (!relativeUrl) return null;

  // Remove any trailing slashes from base URL and leading slashes from relative URL
  baseUrl = baseUrl.replace(/\/+$/, '');
  relativeUrl = relativeUrl.replace(/^\/+/, '');

  // Combine base URL and relative URL
  return `${baseUrl}/${relativeUrl}`;
}

// Function to extract numerical value from text
function extractNumber(text) {
  const match = text.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

// Function to reorder bidirectional text manually
function reorderBidiText(text) {
  // Check if the entire text is in Hebrew
  if (/^[\u0590-\u05FF\s]+$/.test(text)) {
    // Reverse the entire string
    return text.split(' ').reverse().join(' ');
  }

  // If the text contains mixed languages, handle each segment separately
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
async function scrapeWebsiteIsracrd(url) {
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
      const firstWordOfSubTitle = getFirstWord(subTitle);
      const backgroundImage = $(element)
        .find('.category-featured-benefit')
        .css('background-image');

      // Only include items with cashback-related keywords
      if (
        containsCashbackKeywords(title) ||
        containsCashbackKeywords(firstWordOfSubTitle)
      ) {
        cashbackItems.push({
          title: reorderBidiText(title),
          subTitle: firstWordOfSubTitle,
          backgroundImage,
        });
      }
    });

    if (cashbackItems.length === 0) {
      console.warn('No cashback items found.');
    }

    // Step 4: Fetch details for each cashback item
    for (const item of cashbackItems) {
      if (item.detailUrl) {
        try {
          const detailData = await axios.get(item.detailUrl);
          const $detail = cheerio.load(detailData.data);

          const cashbackTitle = $detail('.cashBack-title').text().trim();
          const cashbackDescription = $detail('.cashBack-description').text().trim();
          const dedicatedCoupon = $detail('.dedicate-coupon-block-store-coupon').text().trim();

          item.cashbackDetails = {
            title: reorderBidiText(cashbackTitle),
            description: reorderBidiText(cashbackDescription),
            dedicatedCoupon: reorderBidiText(dedicatedCoupon),
          };
        } catch (detailError) {
          console.error(`Error fetching details for item ${item.title}:`, detailError);
        }
      }
    }

    // Step 5: Print the extracted data
    console.log(`Data from ${url}:`, cashbackItems);
    pipeToSwipeAdvisor(cashbackItems);
  } catch (error) {
    console.error(`Error scraping the website ${url}:`, error);
    if (retries > 0) {
      console.warn(`Retrying ${url} (${retries} retries left)...`);
      await scrapeWebsiteIsracrd(url, retries - 1);
    } else {
      console.error(`Error scraping the website ${url}:`, error);
    }
  }


  function getFirstWord(text) {
    // Trim any extra spaces
    text = text.trim();

    // Define the regular expression to match common delimiters
    const delimiterPattern = /[ \-_.,;:|!]/;

    // Split the text by the defined delimiters and return the first part
    return text.split(delimiterPattern)[0].trim();
  }

}

async function scrapeWebsiteHever(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const cashbackItems = [];
    const baseUrl = new URL(url).origin;

    $('.retailer_preview ').each((index, element) => {
      const title = $(element).find('.tete.ellipsis').text().trim();
      const subTitle = $(element).find('.slider h4 ').text().trim();
      // Extract image URL from src attribute
      const imageUrl = $(element).find('.preview_logo').attr('data-src');
      // Convert relative URL to absolute URL
      const backgroundImage = resolveUrl(baseUrl, imageUrl);

      if (containsCashbackKeywords(title) || containsCashbackKeywords(subTitle)) {
        cashbackItems.push({
          title: reorderBidiText(title),
          subTitle: subTitle,
           backgroundImage,
        });
      }
    });

    if (cashbackItems.length === 0) {
      console.warn('No cashback items found.');
    }

    // Step 4: Fetch details for each cashback item
    for (const item of cashbackItems) {
      if (item.detailUrl) {
        try {
          const detailData = await axios.get(item.detailUrl);
          const $detail = cheerio.load(detailData.data);

          const cashbackTitle = $detail('.cashBack-title').text().trim();
          const cashbackDescription = $detail('.cashBack-description').text().trim();
          const dedicatedCoupon = $detail('.dedicate-coupon-block-store-coupon').text().trim();

          item.cashbackDetails = {
            title: reorderBidiText(cashbackTitle),
            description: reorderBidiText(cashbackDescription),
            dedicatedCoupon: reorderBidiText(dedicatedCoupon),
          };
        } catch (detailError) {
          console.error(`Error fetching details for item ${item.title}:`, detailError);
        }
      }
    }

    // Step 5: Print the extracted data
    // console.log(`Data from ${url}:`, cashbackItems);
    pipeToSwipeAdvisor(cashbackItems);
  } catch (error) {
    console.error(`Error scraping the website ${url}:`, error);
  }


  function getFirstWord(text) {
    // Trim any extra spaces
    text = text.trim();

    // Define the regular expression to match common delimiters
    const delimiterPattern = /[ \-_.,;:|!]/;

    // Split the text by the defined delimiters and return the first part
    return text.split(delimiterPattern)[0].trim();
  }

}


const pipeToSwipeAdvisor = (data) => {
  const newBenefits = data.map((benefit) => ({
    businessName: benefit.title,
    businessSubTitle: reorderBidiText(benefit.subTitle),
    creditCardId: '6658b688892bce96bd5d588f',
    discountType: 'cashback',
    valueType: benefit.subTitle.includes('%') ? 'percentage' : 'number',
    value: extractNumber(benefit.subTitle),
    minPurchaseAmount: 0,
  }));

  console.log('Piped data to SwipeAdvisor:', newBenefits);
};


// scrapeWebsiteIsracrd('https://benefits.isracard.co.il/parentcategories/online-benefits/');
scrapeWebsiteHever('https://www.cashback-hvr.co.il/all-shops?mid=4198574&sig=54948354b4a0cc12c9879cfc4c1c8dbf');





