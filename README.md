# GermanZero API

An API to access GermanZero.

## What is it for

[GermanZero](https://germanzero.de) uses a handful of tools (like a Chat and a Wiki) which are used by its members to organize themselves. This API allows to add new members to all of these systems and add them to a matching group.

## Current state

Since there will be a big announcement in december, we expect a larger number of people leaving their data on our website. We want to store this data in a first step in our CRM system. CiviCRM is specialized on organizations like GermanZero, and suports memberships, events, donations and so on.

Our focus is therefore on the `POST /contacts` route for now.

Next step will be provide functionality on the website to help users to find the member of the Bundestag from their electoral district.

## You want to help out?

You're very welcome!

Add issues, or event pull requests or just get in touch to talk about making things better or easier!

## Installation

To install this software first you need to have:

- A running instance of CiviCRM
- Node.js >= 12.13.0 installed

Then you should

1. Clone the repository `git clone https://github.com/GermanZero-de/api.git`
2. Change to the new folder `cd api`
3. Install dependencies: `npm install`
4. Generate keys by running `node create-keys`
5. Create an `.env` file by copying `.env-sample` and fill out all values (use the keys from the step before)
6. Run the server by calling `npm start`

It is also possible to use our [docker image](https://hub.docker.com/repository/docker/germanzero/api) but you need to specify all environment variables like described in `.env-sample`.
