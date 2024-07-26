"use client";

import { ESize, EState, MbButton } from "mintbase-ui";
import { useEffect, useState } from "react";
import { SelectedNft } from "@/types/types";
import { getAllowedFTs, initContract } from "../near-api";
import BuyModal from "./BuyModal/BuyModal";
import LendingsPage from "../section/lending/LendingsPage"
import BorrowingsPage from "../section/borrowing/BorrowingsPage"
import MyNftPage from "../section/myNft/MyNftPage"
import ShopPage from "../section/shop/ShopPage"
import ListingAcceptPage from "../section/shop/ListingAcceptPage"
import AcceptBorrowingPage from "../section/shop/NftPage"
import ListingCreationPage from "../section/shop/ListingCreationPage"
import NftDetails from "../section/shop/NftPage"

export function classNames(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const navigation = [
  {
    name: "Shops",
    current: false
  },
  {
    name: "My NFT",
    current: false,
  },
  // {
  //   name: "Lending",
  //   current: false
  // },
  // {
  //   name: "Borrowing",
  //   current: false,
  // },
];

const LandingPage = () => {
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState({} as SelectedNft);
  const [lendModal, setLendModal] = useState("Shops");
  const [shopRent, setShopRent] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      await initContract();
      if (typeof window !== 'undefined') {
        window.CURRENCY_OPTIONS = await getAllowedFTs();
      }
    };
    fetchData();
  }, []);


  const handleCloseBuyModal = () => {
    setSelectedItem({} as SelectedNft);
    setShowBuyModal(false);
  };

  const handleRentModal = (name: string) => {
    setLendModal(name)
  }

  const handleShop = (item: { title: string }) => {
    setLendModal(item.title);
    setShopRent(item);
  }

  return (
    <div className="w-full flex flex-col items-start gap-4">
      <div className="text-[40px]">Rent Marketplace</div>
      <div>
        <div className="mt-4 flex">
          <a
            target="_blank"
            rel="noreferrer"
            href="https://mintbase.xyz/leaderboard"
          >
            <MbButton
              label="See Leaderboard"
              size={ESize.MEDIUM}
              state={EState.ACTIVE}
            />
          </a>
        </div>
        <div className="mt-5 flex flex-1 flex-col">
          <nav className="flex-1 flex space-y-1 space-x-10 px-2 pb-4">
            {navigation.map((item) => (
              <button
                key={item.name}
                className={classNames(
                  item.current
                    ? "bg-zinc-800 text-white"
                    : "text-black-100 hover:bg-zinc-600",
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md"
                )}
                onClick={()=>handleRentModal(item.name)}
              >
                {item.name}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex w-full">
        {lendModal === "Shops" && <ShopPage handleClick={handleShop}/>}
        {lendModal === "My NFT" && <MyNftPage handleClick={handleShop}/>}
        {lendModal === "Lending" && <LendingsPage/>}
        {lendModal === "Borrowing" && <BorrowingsPage/>}
        {lendModal === "rent" && <ListingAcceptPage params ={shopRent}/>}
        {lendModal === "nfts" && <AcceptBorrowingPage params ={shopRent} handleClick={handleShop}/>}
        {lendModal === "details" && <NftDetails params ={shopRent} handleClick={handleShop}/>}
        {lendModal === "lend" && <ListingCreationPage params ={shopRent} handleClick ={() =>setLendModal("My NFT")}/>}
      </div>
      <div className="mx-24 mt-4">
        {!!showBuyModal && (
          <BuyModal closeModal={handleCloseBuyModal} item={selectedItem} />
        )}
      </div>
    </div>
  );
};

export default LandingPage;
