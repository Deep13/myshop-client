import { Link } from "react-router-dom";
import { RiShutDownLine } from "react-icons/ri";

export default function Header() {

    const logout = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("auth");
        window.location.href = "/login";
    };

    return (
        <header style={styles.header}>
            {/* <h2 style={styles.h}>My Website</h2> */}

            <nav style={styles.nav}>
                <Link to="/" style={styles.link}>Home</Link>
                <Link to="/sales" style={styles.link}>Sales</Link>
                <Link to="/purchase" style={styles.link}>Purchase</Link>
                <Link to="/items" style={styles.link}>Items</Link>
                <Link to="/reports" style={styles.link}>Reports</Link>
            </nav>
            <RiShutDownLine style={{ color: "#fff", cursor: "pointer" }} onClick={logout} />

        </header>
    );
}

const styles = {
    header: {
        background: "#034C9D",
        padding: "10px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 20
    },
    nav: {
        display: "flex",
        gap: "20px"
    },
    link: {
        textDecoration: "none",
        color: "#fff",
        fontWeight: "500"
    }
};
