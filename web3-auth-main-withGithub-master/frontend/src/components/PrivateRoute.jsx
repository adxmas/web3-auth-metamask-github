import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Route, Redirect } from "react-router-dom";
import { setToken } from "../state/slices/authSlice";

const PrivateRoute = ({ component: Component, ...rest }) => {
  const dispatch = useDispatch();
  const reduxToken = useSelector((s) => s.auth.token);
  const cookie = document.cookie.split("jwt=")[1];

  const handleCockie = () => {
    document.cookie = "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC;"
    dispatch(setToken(cookie));
  }

  cookie && handleCockie();

  return (
    // Show the component only when the user is logged in
    // Otherwise, redirect the user to /signin page
    <Route
      {...rest}
      render={(props) =>
        reduxToken ? <Component {...props} /> : <Redirect to="/" />
      }
    />
  );
};

export default PrivateRoute;
