import { Outlet } from "react-router-dom";
import Header from "./comps/Header.jsx";

export default function Layout() {
    return (
        <div style={{ flex: 1 }}>
            <Header />
            <Outlet />
        </div>
    );
}
