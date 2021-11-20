import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  token: null,
};

export const authSlice = createSlice({
  name: "counter",
  initialState,
  reducers: {
    setToken: (state, action) => {
      state.token = action.payload;
    },
    deleteToken: (state) => {
      state.token = null;
    },
  },
});

// Action creators are generated for each case reducer function
export const { setToken, deleteToken } = authSlice.actions;

export default authSlice.reducer;
