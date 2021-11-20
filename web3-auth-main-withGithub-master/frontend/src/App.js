import "./App.css";
import { BrowserRouter as Router, Switch } from "react-router-dom";
import Login from "./components/Login";
import Profile from "./components/Profile";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <Router>
      <Switch>
        <PrivateRoute exact path="/">
          <Login />
        </PrivateRoute>
        <PrivateRoute exact path="/profile">
          <Profile />
        </PrivateRoute>
      </Switch>
    </Router>
  );
}

export default App;
