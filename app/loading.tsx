import styles from "./status.module.css";

export default function Loading() {
  return (
    <main className={styles.wrap}>
      <div className="spinner" style={{ width: 20, height: 20 }} />
      <div className={styles.label}>Memuat</div>
    </main>
  );
}
