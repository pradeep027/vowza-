-- Application-owned objects in Supabase-managed schemas.
-- This migration deliberately touches managed schemas only for the auth.users trigger
-- that invokes public.handle_new_user and storage.objects policies owned by Vowza.
-- It does not recreate managed auth/storage tables, functions, indexes, or constraints.
-- The schema-only baseline contains no storage.buckets row data; no bucket INSERTs are
-- fabricated here. Bucket rows/public flags require a separate approved data export.

-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();


--
-- Name: objects Admins can read business documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read business documents" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'business-documents'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can read contracts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read contracts" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'contracts'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can read documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read documents" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'documents'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can read payment proofs; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read payment proofs" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'payment-proofs'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can read verification; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read verification" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'verification'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can read verification documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can read verification documents" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'verification-documents'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can upload contracts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can upload contracts" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'contracts'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects Admins can view all worker documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins can view all worker documents" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'worker-documents'::"text") AND "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));


--
-- Name: objects Admins delete auth promotional images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins delete auth promotional images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'auth-promotional'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));


--
-- Name: objects Admins insert auth promotional images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins insert auth promotional images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'auth-promotional'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));


--
-- Name: objects Admins update auth promotional images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins update auth promotional images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'auth-promotional'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))))) WITH CHECK ((("bucket_id" = 'auth-promotional'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role")::"text" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));


--
-- Name: objects Anyone can view provider media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Anyone can view provider media" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'provider-media'::"text"));


--
-- Name: objects Artists can delete their own gallery items; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can delete their own gallery items" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'gallery'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can delete their own portfolio images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can delete their own portfolio images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'portfolio-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can delete their own profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can delete their own profile images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'artist-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can delete their own videos; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can delete their own videos" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'videos'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can update their own gallery items; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can update their own gallery items" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'gallery'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can update their own portfolio images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can update their own portfolio images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'portfolio-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can update their own profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can update their own profile images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'artist-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Artists can update their own videos; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Artists can update their own videos" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'videos'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated artists can upload portfolio images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated artists can upload portfolio images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'portfolio-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated artists can upload profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated artists can upload profile images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'artist-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated artists can upload to gallery; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated artists can upload to gallery" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'gallery'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated artists can upload videos; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated artists can upload videos" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'videos'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated customers can upload profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated customers can upload profile images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'customer-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated users can delete provider media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can delete provider media" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'provider-media'::"text") AND ("auth"."role"() = 'authenticated'::"text")));


--
-- Name: objects Authenticated users can upload cover banners; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload cover banners" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'cover-banners'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated users can upload event images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload event images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'event-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated users can upload portfolio items; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload portfolio items" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'portfolio'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated users can upload profile pictures; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload profile pictures" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'profile-pictures'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Authenticated users can upload provider media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload provider media" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'provider-media'::"text") AND ("auth"."role"() = 'authenticated'::"text")));


--
-- Name: objects Authenticated users can upload thumbnails; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload thumbnails" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'thumbnails'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Chat participants can upload files; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Chat participants can upload files" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'chat-files'::"text") AND ((("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]) OR (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2]))));


--
-- Name: objects Customers can delete their own profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Customers can delete their own profile images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'customer-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Customers can update their own profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Customers can update their own profile images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'customer-profile-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Participants can read chat files; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Participants can read chat files" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'chat-files'::"text") AND ((("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]) OR (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2]))));


--
-- Name: objects Public read access for artist profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for artist profile images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'artist-profile-images'::"text"));


--
-- Name: objects Public read access for cover banners; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for cover banners" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'cover-banners'::"text"));


--
-- Name: objects Public read access for customer profile images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for customer profile images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'customer-profile-images'::"text"));


--
-- Name: objects Public read access for event images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for event images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'event-images'::"text"));


--
-- Name: objects Public read access for gallery; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for gallery" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'gallery'::"text"));


--
-- Name: objects Public read access for portfolio; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for portfolio" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'portfolio'::"text"));


--
-- Name: objects Public read access for portfolio images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for portfolio images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'portfolio-images'::"text"));


--
-- Name: objects Public read access for profile pictures; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for profile pictures" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'profile-pictures'::"text"));


--
-- Name: objects Public read access for thumbnails; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for thumbnails" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'thumbnails'::"text"));


--
-- Name: objects Public read access for videos; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read access for videos" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'videos'::"text"));


--
-- Name: objects Public read auth promotional images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public read auth promotional images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'auth-promotional'::"text"));


--
-- Name: objects Users can delete own provider media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete own provider media" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'provider-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can delete their own business documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete their own business documents" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'business-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can delete their own event images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete their own event images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'event-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can delete their own thumbnails; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete their own thumbnails" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'thumbnails'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can delete their own verification documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete their own verification documents" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'verification-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can read their own contracts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can read their own contracts" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'contracts'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can read their own payment proofs; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can read their own payment proofs" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'payment-proofs'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update own provider media; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update own provider media" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'provider-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own business documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own business documents" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'business-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own cover banners; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own cover banners" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'cover-banners'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own documents" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own event images; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own event images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'event-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own portfolio items; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own portfolio items" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'portfolio'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own profile pictures; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own profile pictures" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'profile-pictures'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own thumbnails; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own thumbnails" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'thumbnails'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own verification; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own verification" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'verification'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can update their own verification documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can update their own verification documents" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'verification-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can upload their own business documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own business documents" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'business-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can upload their own documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own documents" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can upload their own payment proofs; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own payment proofs" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'payment-proofs'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can upload their own verification; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own verification" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'verification'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Users can upload their own verification documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can upload their own verification documents" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'verification-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Workers can upload own documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Workers can upload own documents" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'worker-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects Workers can view own documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Workers can view own documents" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'worker-documents'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects about-us-admin-delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "about-us-admin-delete" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'about-us'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects about-us-admin-upload; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "about-us-admin-upload" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'about-us'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))));


--
-- Name: objects about-us-public-read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "about-us-public-read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'about-us'::"text"));


--
-- Name: objects anchor_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "anchor_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'anchor-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'anchor-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects anchor_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "anchor_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'anchor-media'::"text"));


--
-- Name: objects band_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "band_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'band-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'band-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects band_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "band_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'band-media'::"text"));


--
-- Name: objects banquet_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "banquet_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'banquet-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'banquet-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects banquet_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "banquet_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'banquet-media'::"text"));


--
-- Name: objects catering_images_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "catering_images_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'catering-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'catering-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects catering_images_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "catering_images_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'catering-images'::"text"));


--
-- Name: objects chat_media_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "chat_media_delete" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'chat-media'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));


--
-- Name: objects chat_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "chat_media_read" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'chat-media'::"text") AND ("auth"."uid"() IS NOT NULL)));


--
-- Name: objects chat_media_upload; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "chat_media_upload" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'chat-media'::"text") AND ("auth"."uid"() IS NOT NULL)));


--
-- Name: objects dancer_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "dancer_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'dancer-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'dancer-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects dancer_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "dancer_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'dancer-media'::"text"));


--
-- Name: objects decorator_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "decorator_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'decorator-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'decorator-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects decorator_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "decorator_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'decorator-media'::"text"));


--
-- Name: objects dj_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "dj_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'dj-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'dj-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects dj_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "dj_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'dj-media'::"text"));


--
-- Name: objects drone_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "drone_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'drone-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'drone-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects drone_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "drone_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'drone-media'::"text"));


--
-- Name: objects makeup_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "makeup_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'makeup-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'makeup-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects makeup_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "makeup_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'makeup-media'::"text"));


--
-- Name: objects mehendi_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "mehendi_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'mehendi-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'mehendi-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects mehendi_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "mehendi_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'mehendi-media'::"text"));


--
-- Name: objects photography_storage_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_storage_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'photography-package-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'photography-package-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects photography_storage_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_storage_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'photography-package-images'::"text"));


--
-- Name: objects photography_videography_storage_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_videography_storage_delete" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'photography-videography-package-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));


--
-- Name: objects photography_videography_storage_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_videography_storage_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'photography-videography-package-images'::"text"));


--
-- Name: objects photography_videography_storage_update; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_videography_storage_update" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'photography-videography-package-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text"))) WITH CHECK ((("bucket_id" = 'photography-videography-package-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));


--
-- Name: objects photography_videography_storage_upload; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "photography_videography_storage_upload" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'photography-videography-package-images'::"text") AND ("auth"."role"() = 'authenticated'::"text")));


--
-- Name: objects priest_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "priest_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'priest-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'priest-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects priest_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "priest_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'priest-media'::"text"));


--
-- Name: objects rental_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "rental_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'rental-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'rental-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects rental_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "rental_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'rental-media'::"text"));


--
-- Name: objects singer_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "singer_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'singer-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'singer-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects singer_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "singer_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'singer-media'::"text"));


--
-- Name: objects videography_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "videography_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'videography-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'videography-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects videography_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "videography_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'videography-media'::"text"));


--
-- Name: objects water_media_owner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "water_media_owner" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'water-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'water-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects water_media_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "water_media_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'water-media'::"text"));


--
-- Name: objects water_product_images_owner_write; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "water_product_images_owner_write" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'water-product-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]))) WITH CHECK ((("bucket_id" = 'water-product-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


--
-- Name: objects water_product_images_public_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "water_product_images_public_read" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'water-product-images'::"text"));


--
