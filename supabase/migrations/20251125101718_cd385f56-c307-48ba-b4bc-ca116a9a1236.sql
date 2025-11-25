-- Delete orphaned users who are not linked to any agency, client, or super admin
DELETE FROM profiles 
WHERE id IN (
  'e1e143f3-0725-4de5-93ed-3804b33c719c',  -- mm44jj00rr@gmail.com
  '33d40e4f-dac1-405f-ad00-ec04dc8707d8'   -- steve@agency.com
);