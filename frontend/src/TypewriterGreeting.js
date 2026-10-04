import React, { useState, useEffect } from 'react'; //[cite: 2]

function TypewriterGreeting() {
  // النص الكامل الذي نريد عرضه بتأثير الآلة الكاتبة
  const fullText = "تعبت وأنت عم تدوّر على (دكتور أو عيادة؟ / مصلّح أو فني صيانة؟ / محل تجاري أو سوبرماركت؟ ...) كل اللي عليك تبحث بـ «دليل مدينة حمص» لتلاقي رقم التواصل والموقع بدقة وبكبسة زر!";
  
  // متغير لتخزين النص الذي يظهر تدريجياً للمستخدم
  const [displayedText, setDisplayedText] = useState('');
  
  // متغير لتتبع رقم (فهرس) الحرف الحالي الذي يتم طباعته
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // التحقق مما إذا كان هناك المزيد من الأحرف في النص لعرضها
    if (currentIndex < fullText.length) {
      // إعداد مؤقت (Timer) لإضافة حرف جديد كل 45 مللي ثانية
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + fullText[currentIndex]); // إضافة الحرف الجديد
        setCurrentIndex((prev) => prev + 1); // الانتقال للحرف الذي يليه
      }, 45); 

      // تنظيف المؤقت عند إلغاء المكون أو تحديثه لتجنب أي مشاكل في الأداء
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, fullText]); //[cite: 2]

  return (
    <p className="text-slate-500 text-xs md:text-base font-medium">
      {/* عرض النص الذي تمت كتابته حتى هذه اللحظة */}
      {displayedText}
      
      {/* 
        إضافة المؤشر (الخط العمودي) 
        - animate-pulse: هي فئة جاهزة في Tailwind تعطي تأثير الوميض (Blinking).
        - inline-block: لضمان ظهور المؤشر بجانب النص مباشرة.
        - font-bold: لجعله سميكاً وواضحاً كالمؤشر الحقيقي.
      */}
      <span className="inline-block ml-0.5 font-bold text-blue-500 animate-pulse" aria-hidden="true">
        |
      </span>
    </p>
  );
}

export default TypewriterGreeting; //[cite: 2]