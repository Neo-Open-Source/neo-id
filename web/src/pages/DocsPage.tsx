import styles from '../styles/DocsPage.module.css'

export default function DocsPage() {
  return (
    <div className={styles.page}>
      <iframe
        src="/scalar.html"
        title="Neo ID API Docs"
        className={styles.frame}
      />
    </div>
  )
}
