# Nova Cam API - Quick Reference

## Authentication
- **POST `/api/users/register`**: Creates a new user.
- **POST `/api/users/login`**: Logs in a user and returns a JWT.

## User
- **GET `/api/users/profile`**: (Protected) Gets the profile of the logged-in user.
- **GET `/api/users/my-nfts`**: (Protected) Gets the NFT collection of the logged-in user.

## NFT Listings
- **GET `/api/nfts/auctions`**: Gets a list of all listings. Can be filtered by status.
- **GET `/api/nfts/auctions/:id`**: Gets the details for a single listing.
- **POST `/api/nfts/approve-listing`**: (Protected) Approves an NFT for sale.
- **POST `/api/nfts/list-item`**: (Protected) Creates a new auction listing.
- **POST `/api/nfts/auctions/bid`**: (Protected) Places a bid on an auction.
- **POST `/api/nfts/auctions/end`**: (Protected) Settles a completed auction.

## Admin
- **POST `/api/nfts/admin/mint-nft`**: (Admin Only) Mints a new NFT to a target address.
- **POST `/api/nfts/admin/mint-tokens`**: (Admin Only) Mints NOVA/POL tokens to a target address.