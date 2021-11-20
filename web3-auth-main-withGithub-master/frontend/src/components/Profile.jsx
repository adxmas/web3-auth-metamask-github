import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router";
import { deleteToken } from "../state/slices/authSlice";
import axios from "axios";
import Web3 from "web3";

let web3 = undefined; // Will hold the web3 instance

export default function Profile() {
  const history = useHistory();
  const dispatch = useDispatch();
  const token = useSelector((s) => s.auth.token);
  const [sync, setSync] = useState(null);
  useEffect(() => {
    !token && history.push("/");
  }, [history, token]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getSync = async () => {
    const data = await axios.get("http://localhost:8000/sync", {
      headers: {
        authentication: token,
      },
    });
    return data.data.sync;
  };

  useEffect(() => {
    getSync().then((res) => setSync(res));
  }, [token]);

  const handleSync = async () => {
    if (sync === "github") {
      await window.ethereum.enable();

      // We don't know window.web3 version, so we use our own instance of Web3
      // with the injected provider given by MetaMask
      web3 = new Web3(window.ethereum);
      const coinbase = await web3.eth.getCoinbase();
      const publicAddress = coinbase.toLowerCase();

      const signature = await web3?.eth.personal.sign(
        "sync",
        publicAddress,
        "" // MetaMask will ignore the password argument here
      );

      console.log(publicAddress);
      const data = await axios.post(
        "http://localhost:8000/sync/metamask",
        { signature },
        {
          headers: {
            authentication: token,
          },
        }
      );
      setSync(getSync());
    } else if (sync === "metamask") {
      const data = await axios.post(
        "http://localhost:8000/sync/github",
        {},
        {
          headers: {
            authentication: token,
          },
        }
      );
    }
  };
  console.log(sync);
  const handleLogout = () => {
    dispatch(deleteToken());
    history.push("/");
  };
  return (
    <>
      <p>token: {token}</p>
      <button disabled={sync === "full" ? true : false} onClick={handleSync}>
        sync
      </button>
      <button onClick={handleLogout}>Log out</button>
    </>
  );
}
