const NotificationsLayout = ({ actions, children }) => {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>
      {children}
    </section>
  );
};

export default NotificationsLayout;
