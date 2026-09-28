import type { ReferencePolicy } from "../types";

// Display-only Shop native document snapshot, emulator-5560, 2026-09-26.
// These merchant terms are not a checkout quote, inventory or fulfillment promise.
export const hudsonGracePolicies: Readonly<
  Record<"refund" | "shipping", ReferencePolicy>
> = {
  refund: {
    title: "Refund policy",
    blocks: [
      {
        kind: "paragraph",
        text: "We pride ourselves on providing the highest quality customer service and are committed to offering product you will use and love forever. However, we understand that sometimes a return or exchange is necessary. We care about your satisfaction are always here to help.",
      },
      {
        kind: "paragraph",
        text: "We hope you love your Hudson Grace items. If you're not completely satisfied with your online purchase, we’ll gladly offer you an exchange or refund for most of our merchandise within 30 days from receipt of product. Proof of purchase is required for a refund. We do not accept returns on the following items: Custom orders, furniture, art, bedding (once opened) and final sale items. Returns are refunded in the original payment form for the merchandise price, less shipping and handling. Shipping and handling charges are non-refundable, unless the item received is damaged, defective or incorrect. Taxes charged are refunded in accordance with state and local laws. Returns sent with postage due will be returned to sender. A one-time price adjustment is offered when an original sales receipt or proof of purchase is presented within 24 hours of order delivery or purchase from a store location. To return an item, simply contact Customer Care via email at customerservice@hudsongracesf.com for a return authorization, then repack and return your package to us:",
      },
      {
        kind: "paragraph",
        text: "Hudson Grace Returns\nHudson Grace Returns c/o Crate and Barrel West Coast DC\n499 Tracy Housewares DC\n1605 Chrisman Road\nTracy, CA 95304",
      },
      {
        kind: "paragraph",
        text: "Most items may also be exchanged at a store location, if accompanied by a receipt or proof of purchase.",
      },
      {
        kind: "paragraph",
        text: "Please note our in-store return policy: You can return your item within 24 hours with proof of purchase for a full refund. We offer an exchange or store credit when returned within 14 days.",
      },
    ],
  },
  shipping: {
    title: "Shipping policy",
    blocks: [
      {
        kind: "heading",
        text: "Standard Parcel Delivery",
      },
      {
        kind: "paragraph",
        text: "Most purchases are shipped to arrive within 5-10 business days upon receipt of order. Our rates accurately reflect costs to package your order safely plus our shipping partners' charges. If you have questions about shipping fees, our Customer Care team is happy to help. Note that items ordered together may not arrive together. We ship to the United States only. Unfortunately, we cannot ship to PO or APO boxes at this time.",
      },
      {
        kind: "heading",
        text: "Express Parcel Delivery",
      },
      {
        kind: "paragraph",
        text: "By choosing Express Ship service during checkout, we will expedite orders for in-stock items. Express Ship orders placed by 12 pm Pacific Time Monday through Thursday will arrive within 3 business days; orders placed by 12 pm Pacific Time Friday through Sunday will arrive the following Wednesday. Deliveries occur Monday through Friday. Rush service is not available for oversized items or out of stock items, and is not available for shipments to Hawaii, Alaska, US Territories, PO boxes or AFO/FPO addresses. Business days do not include holidays. We are not responsible for events outside of our control, including but not limited to weather-related delays, work stoppages or delays or other unexpected circumstances.",
      },
      {
        kind: "heading",
        text: "White Glove Furniture Delivery",
      },
      {
        kind: "list",
        items: [
          "At Hudson Grace we offer White Glove Furniture Delivery on select furniture items.",
          "White Glove Furniture Delivery is a flat rate (per trip) charge of $399 for select furniture delivered to ZIP codes within the contiguous U.S.",
          "This service is only eligible on items labeled with White Glove Furniture Delivery on their product page.",
          "After placing your order, our 3rd party delivery partner will contact you to confirm your shipment and provide an estimated time of delivery.",
          "Furniture eligible for White Glove Furniture Delivery is in-stock and ready to deliver within 28 days, though this lead time may vary.",
          "Prior to receiving your order, our delivery partner will contact you directly to confirm a delivery window.",
          "An authorized individual must be home during your scheduled delivery window to accept and inspect your items and sign the delivery receipt.",
          "In the event of any imperfection noted at the time of delivery, please contact Hudson Grace Customer Service for assistance.",
        ],
      },
      {
        kind: "heading",
        text: "Basic Freight Furniture Delivery",
      },
      {
        kind: "list",
        items: [
          "At Hudson Grace we offer Basic Freight Furniture Delivery on select furniture items.",
          "Basic Freight Furniture ships boxed or palletized to ZIP codes within the contiguous U.S. and will arrive at your door.",
          "This service is only eligible on items labeled with Basic Freight Delivery on their product page.",
          "All Furniture shipped Basic Freight Delivery travels Ground. Express shipping is not available at this time.",
          "The expected shipping window for furniture eligible for Basic Freight Furniture Delivery is up to 21 business days.",
          "Tracking information for items shipped Basic Freight Furniture Delivery will become available once your item has shipped.",
          "In the event of any imperfection noted at the time of delivery, please contact Hudson Grace Customer Service for assistance.",
        ],
      },
      {
        kind: "paragraph",
        text: "Effective July 28, 2023",
      },
      {
        kind: "table",
        rows: [
          ["Order Subtotal", "Ground Shipping Price"],
          ["$0.00 - $900", "$125.00"],
          ["$900.01 - $1300", "$145.00"],
          ["$1300.01 - $9999", "$175.00"],
        ],
      },
      {
        kind: "paragraph",
        text: "Note:",
      },
      {
        kind: "paragraph",
        text: "Delivery and processing charges are included in the shipping fees.",
      },
      {
        kind: "heading",
        text: "Parcel Shipping and Freight Delivery Fees",
      },
      {
        kind: "list",
        items: [
          "Charges shown below are based on the total value of merchandise shipped to each address.",
          "All shipping charges include handling, order processing, item selection, packaging and transportation of items.",
          "Oversize shipping charges may apply to some items due to large size or bulkiness.",
        ],
      },
      {
        kind: "heading",
        text: "Standard and Express Parcel Shipping Fees Effective July 28, 2023",
      },
      {
        kind: "table",
        rows: [
          ["Order Subtotal", "Ground Shipping Price", "Express Shipping Price"],
          ["$0.00 - $15", "$6.00", "$29.90"],
          ["$15.01 - $25", "$7.00", "$31.90"],
          ["$25.01 - $35", "$9.00", "$32.90"],
          ["$35.01 - $45", "$9.00", "$33.90"],
          ["$45.01 - $65", "$12.00", "$35.90"],
          ["$65.01 - $95", "$15.00", "$38.90"],
          ["$95.01 - $125", "$18.00", "$41.90"],
          ["$125.01 - $145", "$24.00", "$44.90"],
          ["$145.01 - $200", "$24.00", "$46.90"],
          ["$200.01 - $300", "$30.00", "$35.00"],
          ["$300.01 - $400", "$35.00", "$60.00"],
          ["$400.01 - $500", "$45.00", "$70.00"],
          ["$500.01 - $600", "$55.00", "$80.00"],
          ["$600.01 - $700", "$65.00", "$90.00"],
          ["$700.01 - $1,000", "$75.00", "$100.00"],
          ["$1,000.01 - $2,000", "$100.00", "$125.00"],
          ["$2,000.01 +", "$200.00", "$225.00"],
        ],
      },
      {
        kind: "paragraph",
        text: "Note:",
      },
      {
        kind: "paragraph",
        text: " Delivery and processing charges are applied for each delivery address on an order.",
      },
      {
        kind: "heading",
        text: "Basic Freight Furniture Delivery Fees Effective March 2, 2022",
      },
      {
        kind: "table",
        rows: [
          ["Order Subtotal", "Ground Shipping Price"],
          ["$0.00 - $900", "$125.00"],
          ["$900.01 - $1300", "$145.00"],
          ["$1300.01 - $9999", "$175.00"],
        ],
      },
      {
        kind: "paragraph",
        text: "Note:",
      },
      {
        kind: "paragraph",
        text: " Delivery and processing charges are included in the shipping fees.",
      },
      {
        kind: "heading",
        text: "White Glove Furniture Delivery Fees Effective March 2, 2022",
      },
      {
        kind: "paragraph",
        text: "White Glove Furniture Delivery is a flat rate (per trip) charge of $399 for select furniture delivered to ZIP codes within the contiguous U.S. For more details see our White Glove Furniture Delivery section.",
      },
      {
        kind: "heading",
        text: "Shipping to Alaska & Hawaii",
      },
      {
        kind: "paragraph",
        text: "For shipments to Alaska and Hawaii, contact our Customer Care team. Expedited delivery and freight delivery is not available to these areas. Your order should arrive in approximately 12–14 business days. Please note that some oversized, heavy and flammable items cannot ship outside the continental US.",
      },
      {
        kind: "heading",
        text: "International Orders",
      },
      {
        kind: "paragraph",
        text: "Unfortunately, we cannot ship to US territories or foreign countries.",
      },
      {
        kind: "heading",
        text: "PO Boxes & APO Boxes",
      },
      {
        kind: "paragraph",
        text: "Our apologies, but we cannot ship to PO or APO boxes at this time. All orders must be shipped to a physical address.",
      },
      {
        kind: "heading",
        text: "Product Availability",
      },
      {
        kind: "paragraph",
        text: "We make every effort to display the most current and accurate product inventory information. If for any reason an item is not available for immediate shipment, we will notify you directly.",
      },
      {
        kind: "heading",
        text: "Gift Cards",
      },
      {
        kind: "paragraph",
        text: "Hudson Grace gift cards ship for free, unless you request 2nd Day or Next Day delivery. Charge for 2nd Day delivery is $5 and Next Day delivery is $10.",
      },
      {
        kind: "heading",
        text: "Payment",
      },
      {
        kind: "paragraph",
        text: "Payment is charged to your credit card once your order is placed. Additional shipping surcharges may apply to some large or heavy items. In this case, our Customer Care team will contact you with options.",
      },
      {
        kind: "heading",
        text: "Pricing Policy",
      },
      {
        kind: "paragraph",
        text: "All prices are in US dollars and are subject to sales tax for residents of California in accordance with state and local laws. Availability, prices and delivery rates are subject to change. There may be errors in the prices, descriptions or images of certain merchandise, and we must reserve the right to restrict orders of those items. Hudson Grace makes every effort to ensure the accuracy of our catalog and website. Omissions and errors are subject to correction.",
      },
    ],
  },
};
