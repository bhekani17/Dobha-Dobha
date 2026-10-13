# Marketplace website

This directory contains the static Dobha marketplace website. It is designed to be hosted from a private Amazon S3 bucket through CloudFront; see [the server deployment guide](../server/README.md).

The public runtime settings are in `config.js`. Do not place secrets or private credentials there. Static AWS hosting is configured separately from the marketplace API. Until the AWS marketplace backend implements and passes parity testing, this website continues to call the current API configured there.
