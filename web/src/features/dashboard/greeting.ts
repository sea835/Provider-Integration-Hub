const weekdayFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "Chào buổi sáng";
  if (hour >= 11 && hour < 13) return "Chào buổi trưa";
  if (hour >= 13 && hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export function longDate(date: Date): string {
  const text = weekdayFormatter.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function displayName(email: string): string {
  return email.split("@")[0] ?? email;
}
