import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs';

dotenv.config()
const ENV = process.env

// Gets all the establishments of a city
async function getEntries(city_name, business_type) {
    let results = [];

    try {
        let url = encodeURI(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${business_type}+in+${city_name}&key=${ENV.GOOGLE_API_KEY}`);
        let hasNextPage = true;

        while (hasNextPage) {
            const response = await axios.get(url);
            results = results.concat(response.data.results);

            if (response.data.next_page_token) {
                // Wait for a few seconds before making the next request with the next_page_token
                await new Promise(resolve => setTimeout(resolve, 2000));
                url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${response.data.next_page_token}&key=${ENV.GOOGLE_API_KEY}`;
            } else {
                hasNextPage = false;
            }
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        return { error };
    } finally {
        console.log('Fetching completed');
    }

    return results;
}

// Gets the details of each restaurant
async function fetchEntriesDetails(entries) {
    let entriesDetails = []
    for (let i = 0; i < entries.length; i++) {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${entries[i].place_id}&key=${ENV.GOOGLE_API_KEY}`;

        try {
            const response = await axios.get(url);
            const result = response.data.result;

            let photos = [];
            if (result.photos && result.photos.length > 0) {
                photos = result.photos.map(photo => {
                    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${ENV.GOOGLE_API_KEY}`;
                });
            }

            let reviews = [];
            let ratings = {
                "5": 0,
                "4": 0,
                "3": 0,
                "2": 0,
                "1": 0
            };
            if (result.reviews && result.reviews.length > 0) {
                reviews = result.reviews.map(review => {
                    if (review.rating in ratings) {
                        ratings[review.rating] += 1;
                    } else {
                        ratings[review.rating] = 1; // Handle unexpected ratings
                    }

                    return {
                        user_id: review.author_name,
                        title: '',
                        review: review.text,
                        rating: review.rating,
                        photos: ''
                    };
                });
            }

            const entryDetail = {
                tripadvisor_url: "",
                name: response.data.result.name,
                price_range: response.data.result.price_level,
                cuisines: "",
                diets: "",
                address: response.data.result.formatted_address,
                gmaps_url: response.data.result.url,
                phone: response.data.result.international_phone_number,
                website: response.data.result.website,
                menu_url: "",
                email: "",
                schedule: response.data.result.opening_hours ? response.data.result.opening_hours.weekday_text : [],
                reviews: reviews,
                photos: photos,
                rating: response.data.result.rating,
                rating_total: response.data.result.user_ratings_total,
                ratings: ratings,
                popular_nearby: "",
                location: [response.data.result.geometry.location.lng, response.data.result.geometry.location.lat]
            };

            entriesDetails.push(entryDetail);
        } catch (error) {
            console.error('Error fetching restaurant details:', error);
            return null;
        }
    }
    return entriesDetails;
}

function saveToJsonFile(data, filename) {
    try {
        fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Data has been saved to ${filename}`);
    } catch (error) {
        console.error('Error writing to JSON file:', error);
    }
}

// Check if city name argument is provided
if (process.argv.length < 4) {
    console.error('Usage: node your_script_name.js <city_name> <business_type>');
    process.exit(1);
}

let cityName = process.argv[2];
let business_type = process.argv[3];

async function main() {
    let initialEntries = await getEntries(cityName, business_type);
    let entriesDetails = await fetchEntriesDetails(initialEntries);
    saveToJsonFile(entriesDetails, `${cityName}_${business_type}_entries.json`);
}

main();