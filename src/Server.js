const Express = require('express');
const Cors = require('cors');
const Dotenv = require('dotenv');
const MySQL = require('mysql');

const App = Express();
App.use(Cors());
App.use(Express.json());

Dotenv.config();

// Create the MySQL connection string using the connection values pulled from the environment variables.
const DBConnection = MySQL.createConnection(`mysql://${process.env.USER}:${process.env.SQL_PASSWORD}@${process.env.HOST}/${process.env.DATABASE_NAME}?port=3306`);

// Route definitions.
App.get('/', (req, res) => {
    res.json({ message: `The API is listening.` });
});

// Route for getting all services from the MySQL database.
App.get('/api/services', (req, res) => {
    DBConnection.query(`SELECT product_name AS 'name', price, variablePrice, consultation_required AS consultation, c.category_name AS category FROM Products JOIN ProductCategory AS c ON c.id = category WHERE product_type = 1`, (err, rows, fields) => {
        if (err) {
            // If the query hits an error, send that error back as the response.
            res.status(500).json({ error: err });
        } else {

            // If the number of rows selected by the query is > 0, send the data as the response. If there were no results, send a message without data.
            if (rows.length > 0) {
                res.status(200).json({ message: `Successfully retrieved all services.`, data: rows });
            } else {
                res.status(200).json({ message: `There are no services currently in the database.` });
            }

        }
    });
});

// Route for getting full detail about a single location, specified by it's id.
App.get('/api/location/:id', (req, res) => {
    // Query the Locations table to get the location data for the requested location id.
    DBConnection.query(`SELECT id, location_name AS name, address, phone FROM Locations WHERE id=?`, [ req.params.id ], (err, rows) => {
        if (err) {
            // If db returns an error, send it back as the response.
            res.status(500).json({ error: err });
        } else {
            if (rows.length <= 0) {
                // If there was no location found, send a message as the response.
                res.status(200).json({ message: `No location could be found with the provided id.` });
            } else {

                // Location details obj to hold the coalesced location data results.
                let locationDetails = {
                    ...rows[0],
                    hours: undefined
                };

                // Query the LocationHours table to get the open & close times for the requested location.
                DBConnection.query(`SELECT weekday, open_time, close_time FROM LocationHours WHERE location=${req.params.id}`, (hErr, hRows) => {
                    if (hErr) {
                        // Error getting the open and close times for the location, send back the error.
                        res.status(500).json({ error: err });
                    } else {

                        if (hRows.length > 0) {
                            // If there are location hours entered into the db, add them to the locationDetails obj.
                            locationDetails.hours = hRows;
                        }

                        // Send the locationDetails obj back as the response.
                        res.status(200).json({ message: `Successfully retrieved location details for id #${req.params.id}.`, data: locationDetails });

                    }
                });

            }
        }
    });
});

// Route for getting detail about all locations.
App.get("/api/location", (req, res) => {
    const mode = (req.query.mode) ? req.query.mode : "basic";

    // Query the Locations database to get all rows.
    DBConnection.query(`SELECT id, location_name AS 'name', address, phone FROM Locations`, async (err, rows) => {
        if (err) { res.status(500).json({ error: err }); }
        else {

            if (rows.length <= 0) { res.status(200).json({ message: `No locations currently exist within the database.` }); }
            else {

                if (mode !== "full") { res.status(200).json({ message: `Successfully retrieved basic data for all locations.`, data: rows }); }
                else {

                    let locationData = [];
                    
                    // Loop through the rows collected and get theirs hours, and then add each row to the locationData obj.
                    for (let i = 0; i < rows.length; i++) {
                        const hours = await completeQuery(`SELECT weekday, open_time, close_time FROM LocationHours WHERE location=${rows[i].id}`, null);
                        locationData.push({
                            ...rows[i],
                            hours: hours
                        });
                    }
                    
                    res.status(200).json({ message: `Successfully retrieved full data for all locations.`, data: locationData });

                }

            }

        }
    });
});

// Route for getting all testimonials.
App.get('/api/testimonials', (req, res) => {
    DBConnection.query("SELECT poster_name AS name, rating, posted, content FROM Testimonials", (err, rows) => {
        if (err) { res.status(500).json({ error: err }); }
        else {

            if (rows.length <= 0) { res.status(200).json({ message: `There are currently no testimonials in the system.` }); }
            else {

                res.status(200).json({ message: `Successfully retrieved all testimonials.`, data: rows });
                
            }
            
        }
    });
});

// Initialize the server.
const PORT = process.env.PORT || 8080;

DBConnection.connect(err => {
    if (err) {
        console.log(`Failed to start server... could not connect to the MySQL database.\n\n${err}`);
    } else {
        App.listen(PORT, () => {
            console.log(`The API server is running.`);
        });
    }
});

// Functions
async function completeQuery(str, params) {
    return await new Promise((resolve, reject) => {
        DBConnection.query(str, params, (err, rows, fields) => {
            if (err) reject(err);
            resolve(rows);
        })
    })
}